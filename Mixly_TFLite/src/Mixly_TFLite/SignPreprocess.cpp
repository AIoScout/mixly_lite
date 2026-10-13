#include "SignPreprocess.hpp"

#include <Arduino.h>
#include <cmath>
#include <cstdlib>
#include <cstring>

#if defined(ESP32) && CONFIG_SPIRAM_SUPPORT
#include "esp32-hal-psram.h"
#define SIGN_PP_HAS_PSRAM 1
#else
#define SIGN_PP_HAS_PSRAM 0
#endif

// ─────────────────────────────────────────────────────────────────────────
// Bit-identical port of the AItraining crop pipeline, adapted from
// koilkl/TFLite image_provider.cpp (which is itself verified against the
// host: 65/65 synthetic focus boxes, 22/22 adaptive boxes).  Changes vs
// the firmware original: runtime frame size instead of compile-time
// FB_W/FB_H, heap scratch instead of .bss statics, and grayscale
// source variants for the P4 IMX219 path.
// ─────────────────────────────────────────────────────────────────────────

namespace TFLiteVision {

// Bit-parity with the host pipeline requires IEEE float32 semantics — the
// compiler must NOT contract a*b+c into FMA (P4's RISC-V FPU has fmadd;
// a contracted sum differs by 1 ulp and flips the final uint8 rounding).
#if defined(__clang__)
// clang has no optimize attribute — host parity builds pass -ffp-contract=off.
#define SIGN_PP_NO_FMA
#elif defined(__GNUC__)
#define SIGN_PP_NO_FMA __attribute__((optimize("-ffp-contract=off")))
#else
#define SIGN_PP_NO_FMA
#endif

namespace {

// Python round-half-even, matching numpy/Python round().
double py_round_d(double x) {
    double f = floor(x);
    if (x - f == 0.5) {
        long r = (long)f;
        return (r & 1) ? (double)(r + 1) : (double)r;
    }
    return floor(x + 0.5);
}
long py_round_l(double x) { return (long)py_round_d(x); }

int hist_value_at_rank(const uint32_t* hist, int total, long rank) {
    uint32_t cdf = 0;
    for (int i = 0; i < 256; i++) {
        cdf += hist[i];
        if (cdf >= (uint32_t)(rank + 1)) return i;
    }
    return 255;
}

// _percentile_from_hist (host): nearest-rank — rank = round-half-even of
// (total-1)*q, then the first bin whose CDF reaches rank+1.
int percentile_from_hist(const uint32_t* hist, int total, double q) {
    if (total <= 0) return 0;
    long rank = py_round_l((double)(total - 1) * q);
    if (rank < 0) rank = 0;
    if (rank > total - 1) rank = total - 1;
    return hist_value_at_rank(hist, total, rank);
}

// numpy.percentile(..., method='linear') on raw values with int()
// truncation — used only by the adaptive fallback peaks (host calls
// np.percentile(region, 15/85) there).
int percentile_linear_from_hist(const uint32_t* hist, int total, double q) {
    if (total <= 0) return 0;
    double pos = (double)(total - 1) * q;
    long lo_rank = (long)floor(pos);
    long hi_rank = (long)ceil(pos);
    if (lo_rank < 0) lo_rank = 0;
    if (lo_rank > total - 1) lo_rank = total - 1;
    if (hi_rank < 0) hi_rank = 0;
    if (hi_rank > total - 1) hi_rank = total - 1;
    int v_lo = hist_value_at_rank(hist, total, lo_rank);
    int v_hi = hist_value_at_rank(hist, total, hi_rank);
    double frac = pos - (double)lo_rank;
    double v = (double)v_lo + frac * (double)(v_hi - v_lo);
    return (int)v;
}

// (|dx| + |dy|) / 2 with replicate borders — _edge_map_u8.
void edge_map_u8(const uint8_t* region, int w, int h, uint8_t* edge) {
    for (int y = 0; y < h; y++) {
        for (int x = 0; x < w; x++) {
            int xl = (x > 0) ? region[y * w + x - 1] : region[y * w + x];
            int xr = (x < w - 1) ? region[y * w + x + 1] : region[y * w + x];
            int yu = (y > 0) ? region[(y - 1) * w + x] : region[y * w + x];
            int yd = (y < h - 1) ? region[(y + 1) * w + x] : region[y * w + x];
            int gx = xr - xl; if (gx < 0) gx = -gx;
            int gy = yd - yu; if (gy < 0) gy = -gy;
            int e = (gx + gy) / 2;
            if (e > 255) e = 255;
            edge[y * w + x] = (uint8_t)e;
        }
    }
}

// Separable box convolution via running sums, zero-padded, kernel centered.
// float32 sequential accumulation — bit-identical to the host np.cumsum.
SIGN_PP_NO_FMA
void box_blur(const float* src, int w, int h, int K, float* tmp, float* dst) {
    int half = K / 2;
    for (int y = 0; y < h; y++) {  // horizontal pass (axis 1)
        float Pj = 0.0f, Pjk = 0.0f;
        for (int i = 0; i < K; i++) {
            int t = i - half;
            if (t >= 0 && t < w) Pjk += src[y * w + t];
        }
        for (int j = 0; j < w; j++) {
            tmp[y * w + j] = Pjk - Pj;
            int t1 = j + K - half;
            if (t1 >= 0 && t1 < w) Pjk += src[y * w + t1];
            int t2 = j - half;
            if (t2 >= 0 && t2 < w) Pj += src[y * w + t2];
        }
    }
    for (int x = 0; x < w; x++) {  // vertical pass (axis 0)
        float Pj = 0.0f, Pjk = 0.0f;
        for (int i = 0; i < K; i++) {
            int t = i - half;
            if (t >= 0 && t < h) Pjk += tmp[t * w + x];
        }
        for (int j = 0; j < h; j++) {
            dst[j * w + x] = Pjk - Pj;
            int t1 = j + K - half;
            if (t1 >= 0 && t1 < h) Pjk += tmp[t1 * w + x];
            int t2 = j - half;
            if (t2 >= 0 && t2 < h) Pj += tmp[t2 * w + x];
        }
    }
}

// Search-window / scoring constants — identical to image_preprocess.py.
#define FB_SEARCH_LEFT 0.10
#define FB_SEARCH_RIGHT 0.90
#define FB_SEARCH_TOP 0.10
#define FB_SEARCH_BOTTOM 0.90
#define FB_FALLBACK_SIDE_FRAC 0.40
#define FB_FALLBACK_CX 0.50
#define FB_FALLBACK_CY 0.50
#define FB_DARK_OFFSET 10
#define FB_EDGE_PERCENTILE 0.90
#define FB_EDGE_MIN 18
#define FB_EDGE_RELAX 8
#define FB_MIN_FOCUS_PIXELS 8
#define FB_PROJECTION_FRAC 0.16
#define FB_PRIOR_CX 0.50
#define FB_PRIOR_CY 0.50
#define FB_PRIOR_SX 0.18
#define FB_PRIOR_SY 0.16
#define FB_LOCAL_PEAK_RATIO 0.68
#define FB_LOCAL_SIDE_SCALE 2.35
#define FB_SUPPORT_PEAK_RATIO 0.40
#define FB_SUPPORT_SIDE_SCALE 1.90
#define FB_ASPECT_TARGET 1.0
#define FB_ASPECT_TOL 0.75
#define FB_FAR_SIDE_FRAC 0.12
#define FB_FAR_SIDE_BOOST 1.16
#define FB_CLOSE_SIDE_FRAC 0.22
#define FB_CLOSE_SIDE_BOOST 1.42
#define FB_BORDER_TOUCH_PX 2
#define FB_BORDER_SIDE_BOOST 1.24
#define FB_BORDER_SHIFT_FRAC 0.16
#define FB_PEAK_CENTER_BLEND 0.68
#define FB_CENTER_CLAMP_FRAC 0.22
#define FB_MIN_SIDE_FRAC 0.25
#define FB_CENTER_BIAS_X 0.10
#define FB_CENTER_BIAS_Y -0.03
#define FB_MAX_RUNS 4096

} // namespace

struct SignPreprocess::Scratch {
    int n = 0;  // maxSide * maxSide
    float* score_map = nullptr;
    float* tmp_buf = nullptr;
    float* target_map = nullptr;
    uint8_t* region = nullptr;
    uint8_t* edge = nullptr;
    uint8_t* mask = nullptr;
    uint8_t* local_mask = nullptr;
    uint8_t* support_mask = nullptr;
    uint8_t* visited = nullptr;
    uint8_t* band_gray = nullptr;
    int* bfs = nullptr;  // FB_MAX_RUNS * 2
    double smooth[256];
    uint32_t raw_hist[256];
};

bool SignPreprocess::begin(int maxSide) {
    end();
    const int n = maxSide * maxSide;
    Scratch* s = (Scratch*)calloc(1, sizeof(Scratch));
    if (!s) return false;
    auto ps_alloc = [](size_t bytes) -> void* {
        void* p = nullptr;
#if SIGN_PP_HAS_PSRAM
        p = ps_malloc(bytes);
#endif
        if (!p) p = malloc(bytes);
        return p;
    };
    s->n = n;
    s->score_map = (float*)ps_alloc((size_t)n * sizeof(float));
    s->tmp_buf = (float*)ps_alloc((size_t)n * sizeof(float));
    s->target_map = (float*)ps_alloc((size_t)n * sizeof(float));
    s->region = (uint8_t*)ps_alloc((size_t)n);
    s->edge = (uint8_t*)ps_alloc((size_t)n);
    s->mask = (uint8_t*)ps_alloc((size_t)n);
    s->local_mask = (uint8_t*)ps_alloc((size_t)n);
    s->support_mask = (uint8_t*)ps_alloc((size_t)n);
    s->visited = (uint8_t*)ps_alloc((size_t)n);
    s->band_gray = (uint8_t*)ps_alloc((size_t)n);
    s->bfs = (int*)ps_alloc((size_t)FB_MAX_RUNS * 2 * sizeof(int));
    const bool ok = s->score_map && s->tmp_buf && s->target_map && s->region && s->edge &&
                    s->mask && s->local_mask && s->support_mask && s->visited &&
                    s->band_gray && s->bfs;
    if (!ok) {
        end();
        return false;
    }
    _scratch = s;
    _maxSide = maxSide;
    return true;
}

void SignPreprocess::end() {
    if (!_scratch) return;
    free(_scratch->score_map); free(_scratch->tmp_buf); free(_scratch->target_map);
    free(_scratch->region); free(_scratch->edge); free(_scratch->mask);
    free(_scratch->local_mask); free(_scratch->support_mask); free(_scratch->visited);
    free(_scratch->band_gray); free(_scratch->bfs);
    free(_scratch);
    _scratch = nullptr;
    _maxSide = 0;
}

// ── Classic focus search (host _focus_bbox) ─────────────────────────────

static CropBox fb_fallback(int w, int h) {
    CropBox out;
    long side = py_round_l((double)(w < h ? w : h) * FB_FALLBACK_SIDE_FRAC);
    if (side < 1) side = 1;
    long cx = py_round_l((double)w * FB_FALLBACK_CX);
    long cy = py_round_l((double)h * FB_FALLBACK_CY);
    out.x1 = (int)(cx - side / 2); if (out.x1 < 0) out.x1 = 0; if (out.x1 > (int)w - (int)side) out.x1 = (int)w - (int)side;
    out.y1 = (int)(cy - side / 2); if (out.y1 < 0) out.y1 = 0; if (out.y1 > (int)h - (int)side) out.y1 = (int)h - (int)side;
    out.x2 = out.x1 + (int)side; out.y2 = out.y1 + (int)side;
    return out;
}

static void fb_search_rect(int w, int h, int* left, int* right, int* top, int* bottom) {
    int l = (int)py_round_d((double)w * FB_SEARCH_LEFT);
    int r = (int)py_round_d((double)w * FB_SEARCH_RIGHT);
    int t = (int)py_round_d((double)h * FB_SEARCH_TOP);
    int b = (int)py_round_d((double)h * FB_SEARCH_BOTTOM);
    if (l < 0) l = 0; if (l > w - 1) l = w - 1;
    if (r < l + 1) r = l + 1; if (r > w) r = w;
    if (t < 0) t = 0; if (t > h - 1) t = h - 1;
    if (b < t + 1) b = t + 1; if (b > h) b = h;
    *left = l; *right = r; *top = t; *bottom = b;
}

// 4-connected bbox from a seed (host _connected_bbox_from_seed).
static int connected_bbox_from_seed(const uint8_t* mask, int w, int h,
                                    int seed_x, int seed_y, uint8_t* visited, int* st,
                                    int* out_x1, int* out_y1, int* out_x2, int* out_y2) {
    if (h <= 0 || w <= 0) return 0;
    int sx = seed_x; if (sx < 0) sx = 0; if (sx > w - 1) sx = w - 1;
    int sy = seed_y; if (sy < 0) sy = 0; if (sy > h - 1) sy = h - 1;
    if (!mask[sy * w + sx]) return 0;
    memset(visited, 0, (size_t)w * h);
    int sp = 0;
    st[sp++] = sx; st[sp++] = sy;
    visited[sy * w + sx] = 1;
    int min_x = sx, max_x = sx, min_y = sy, max_y = sy;
    while (sp > 0) {
        int py = st[--sp];
        int px = st[--sp];
        if (px < min_x) min_x = px; if (px > max_x) max_x = px;
        if (py < min_y) min_y = py; if (py > max_y) max_y = py;
        if (px > 0 && mask[py * w + px - 1] && !visited[py * w + px - 1]) { visited[py * w + px - 1] = 1; st[sp++] = px - 1; st[sp++] = py; }
        if (px + 1 < w && mask[py * w + px + 1] && !visited[py * w + px + 1]) { visited[py * w + px + 1] = 1; st[sp++] = px + 1; st[sp++] = py; }
        if (py > 0 && mask[(py - 1) * w + px] && !visited[(py - 1) * w + px]) { visited[(py - 1) * w + px] = 1; st[sp++] = px; st[sp++] = py - 1; }
        if (py + 1 < h && mask[(py + 1) * w + px] && !visited[(py + 1) * w + px]) { visited[(py + 1) * w + px] = 1; st[sp++] = px; st[sp++] = py + 1; }
    }
    *out_x1 = min_x; *out_y1 = min_y; *out_x2 = max_x; *out_y2 = max_y;
    return 1;
}

// Weighted center inside a bbox (host _weighted_center_in_bbox), float sums.
static void weighted_center_in_bbox(const float* weight_map, int w, int h,
                                    int bx1, int by1, int bx2, int by2,
                                    double fb_cx, double fb_cy,
                                    double* cx, double* cy) {
    int x0 = bx1; if (x0 < 0) x0 = 0; if (x0 > w - 1) x0 = w - 1;
    int y0 = by1; if (y0 < 0) y0 = 0; if (y0 > h - 1) y0 = h - 1;
    int x1 = bx2 + 1; if (x1 < x0 + 1) x1 = x0 + 1; if (x1 > w) x1 = w;
    int y1 = by2 + 1; if (y1 < y0 + 1) y1 = y0 + 1; if (y1 > h) y1 = h;
    double total = 0.0, wx = 0.0, wy = 0.0;
    for (int y = y0; y < y1; y++) {
        for (int x = x0; x < x1; x++) {
            double v = (double)weight_map[y * w + x];
            if (v < 0.0) v = 0.0;
            total += v;
            wx += v * (double)x;
            wy += v * (double)y;
        }
    }
    if (total <= 1e-6) { *cx = fb_cx; *cy = fb_cy; return; }
    *cx = wx / total;
    *cy = wy / total;
}

SIGN_PP_NO_FMA
CropBox SignPreprocess::findSearchBox(const uint8_t* gray, int w, int h) {
    Scratch* s = _scratch;
    CropBox out = {0, 0, 0, 0};
    if (!s || w * h > s->n) return fb_fallback(w, h);

    int left, right, top, bottom;
    fb_search_rect(w, h, &left, &right, &top, &bottom);
    const int sw = right - left, sh = bottom - top;

    for (int y = 0; y < sh; y++)
        for (int x = 0; x < sw; x++)
            s->region[y * sw + x] = gray[(top + y) * w + (left + x)];
    const int total = sw * sh;
    if (total <= 0) return fb_fallback(w, h);

    uint32_t hist[256];
    memset(hist, 0, sizeof(hist));
    for (int i = 0; i < total; i++) hist[s->region[i]]++;
    int p20 = percentile_from_hist(hist, total, 0.20);
    int p35 = percentile_from_hist(hist, total, 0.35);
    int thr = (p35 < p20 + FB_DARK_OFFSET) ? p35 : (p20 + FB_DARK_OFFSET);
    int dark_thr = thr;

    edge_map_u8(s->region, sw, sh, s->edge);
    memset(hist, 0, sizeof(hist));
    for (int i = 0; i < total; i++) hist[s->edge[i]]++;
    int edge_thr = percentile_from_hist(hist, total, (double)FB_EDGE_PERCENTILE);
    if (edge_thr < FB_EDGE_MIN) edge_thr = FB_EDGE_MIN;

    int mask_count = 0;
    for (int y = 0; y < sh; y++) {
        for (int x = 0; x < sw; x++) {
            int i = y * sw + x;
            uint8_t m = (s->region[i] <= thr && s->edge[i] >= edge_thr) ? 1 : 0;
            s->mask[i] = m;
            mask_count += m;
            int ds = thr - (int)s->region[i]; if (ds < 0) ds = 0;
            int es = (int)s->edge[i] - edge_thr; if (es < 0) es = 0;
            s->target_map[i] = (float)ds * ((float)es + 1.0f);
        }
    }
    if (mask_count < FB_MIN_FOCUS_PIXELS) {
        int relax_thr = edge_thr - 6;
        if (relax_thr < FB_EDGE_RELAX) relax_thr = FB_EDGE_RELAX;
        dark_thr = p20;
        mask_count = 0;
        for (int y = 0; y < sh; y++) {
            for (int x = 0; x < sw; x++) {
                int i = y * sw + x;
                uint8_t m = (s->region[i] <= p20 && s->edge[i] >= relax_thr) ? 1 : 0;
                s->mask[i] = m;
                mask_count += m;
                int ds = p20 - (int)s->region[i]; if (ds < 0) ds = 0;
                int es = (int)s->edge[i] - relax_thr; if (es < 0) es = 0;
                s->target_map[i] = (float)ds * ((float)es + 1.0f);
            }
        }
    }
    if (mask_count < FB_MIN_FOCUS_PIXELS) return fb_fallback(w, h);

    // Score map: box convolution + gaussian priors (float32 cumsum, float64 exp).
    int K = (int)py_round_d((double)(sh < sw ? sh : sw) * FB_PROJECTION_FRAC);
    if (K < 3) K = 3;
    if (K % 2 == 0) K += 1;
    box_blur(s->target_map, sw, sh, K, s->tmp_buf, s->score_map);
    double peak = 0.0;
    for (int i = 0; i < total; i++) if (s->score_map[i] > peak) peak = s->score_map[i];
    if (peak <= 0.0) return fb_fallback(w, h);

    for (int y = 0; y < sh; y++) {
        double ys = (double)(float)((double)y / (double)(sh - 1));
        double dy = (ys - (double)FB_PRIOR_CY) / (double)FB_PRIOR_SY;
        double py = exp(-0.5 * dy * dy);
        for (int x = 0; x < sw; x++) {
            double xs = (double)(float)((double)x / (double)(sw - 1));
            double dx = (xs - (double)FB_PRIOR_CX) / (double)FB_PRIOR_SX;
            double px = exp(-0.5 * dx * dx);
            s->score_map[y * sw + x] = (s->score_map[y * sw + x] * py) * px;
        }
    }
    peak = 0.0;
    for (int i = 0; i < total; i++) if (s->score_map[i] > peak) peak = s->score_map[i];
    if (peak <= 0.0) return fb_fallback(w, h);

    double local_thr = peak * (double)FB_LOCAL_PEAK_RATIO;
    for (int i = 0; i < total; i++) s->local_mask[i] = s->score_map[i] >= local_thr ? 1 : 0;

    memset(s->visited, 0, (size_t)total);
    float best_score = -1.0f;
    int best_span_w = 0, best_span_h = 0;
    int best_bx1 = 0, best_by1 = 0, best_bx2 = 0, best_by2 = 0;
    int best_peak_x = 0, best_peak_y = 0;

    for (int y = 0; y < sh; y++) {
        for (int x = 0; x < sw; x++) {
            int i0 = y * sw + x;
            if (!s->local_mask[i0] || s->visited[i0]) continue;
            int* st = s->bfs; int sp = 0;
            st[sp++] = x; st[sp++] = y;
            s->visited[i0] = 1;
            int min_x = x, max_x = x, min_y = y, max_y = y;
            double wsum = 0.0, wx = 0.0, wy = 0.0;
            double lpeak = -1.0; int lpx = x, lpy = y;
            while (sp > 0) {
                int py = st[--sp];
                int px = st[--sp];
                int ii = py * sw + px;
                double v = (double)s->score_map[ii];
                wsum += v; wx += v * (double)px; wy += v * (double)py;
                if (v > lpeak) { lpeak = v; lpx = px; lpy = py; }
                if (px < min_x) min_x = px; if (px > max_x) max_x = px;
                if (py < min_y) min_y = py; if (py > max_y) max_y = py;
                if (px > 0 && s->local_mask[py * sw + px - 1] && !s->visited[py * sw + px - 1]) { s->visited[py * sw + px - 1] = 1; st[sp++] = px - 1; st[sp++] = py; }
                if (px + 1 < sw && s->local_mask[py * sw + px + 1] && !s->visited[py * sw + px + 1]) { s->visited[py * sw + px + 1] = 1; st[sp++] = px + 1; st[sp++] = py; }
                if (py > 0 && s->local_mask[(py - 1) * sw + px] && !s->visited[(py - 1) * sw + px]) { s->visited[(py - 1) * sw + px] = 1; st[sp++] = px; st[sp++] = py - 1; }
                if (py + 1 < sh && s->local_mask[(py + 1) * sw + px] && !s->visited[(py + 1) * sw + px]) { s->visited[(py + 1) * sw + px] = 1; st[sp++] = px; st[sp++] = py + 1; }
            }
            if (wsum <= 0.0) continue;
            {
                int tcount = (min_x <= FB_BORDER_TOUCH_PX ? 1 : 0)
                           + (min_y <= FB_BORDER_TOUCH_PX ? 1 : 0)
                           + (max_x >= sw - 1 - FB_BORDER_TOUCH_PX ? 1 : 0)
                           + (max_y >= sh - 1 - FB_BORDER_TOUCH_PX ? 1 : 0);
                if (tcount >= 2) continue;
            }
            int span_w = max_x - min_x + 1, span_h = max_y - min_y + 1;
            double aspect = (double)span_w / (double)(span_h > 0 ? span_h : 1);
            double aspect_err = aspect - (double)FB_ASPECT_TARGET; if (aspect_err < 0) aspect_err = -aspect_err;
            if (aspect_err > (double)FB_ASPECT_TOL) continue;
            double aspect_score = 1.0 - aspect_err / (double)FB_ASPECT_TOL;
            if (aspect_score < 0.2) aspect_score = 0.2;
            double area_score = (double)(span_w * span_h) / (double)(K * K > 0 ? K * K : 1);
            if (area_score > 1.0) area_score = 1.0;
            double cx = (wx / wsum) / (double)(sw - 1 > 0 ? sw - 1 : 1);
            double cy = (wy / wsum) / (double)(sh - 1 > 0 ? sh - 1 : 1);
            double dx = (cx - (double)FB_PRIOR_CX) / (double)FB_PRIOR_SX;
            double dy = (cy - (double)FB_PRIOR_CY) / (double)FB_PRIOR_SY;
            double csx = exp(-0.5 * dx * dx);
            double csy = exp(-0.5 * dy * dy);
            double center_score = 0.35 + 0.65 * csx * csy;
            double sc = wsum * aspect_score * (0.6 + 0.4 * area_score) * center_score;
            if (sc > best_score) {
                best_score = sc;
                best_span_w = span_w; best_span_h = span_h;
                best_bx1 = min_x; best_by1 = min_y; best_bx2 = max_x; best_by2 = max_y;
                best_peak_x = lpx; best_peak_y = lpy;
            }
        }
    }
    if (best_score < 0.0f) return fb_fallback(w, h);

    double component_side_frac = (double)(best_span_w > best_span_h ? best_span_w : best_span_h) /
                                 (double)((sh < sw ? sh : sw) > 0 ? (sh < sw ? sh : sw) : 1);
    int sx1, sy1, sx2, sy2;
    for (int i = 0; i < total; i++) s->support_mask[i] = s->region[i] <= dark_thr ? 1 : 0;
    if (!connected_bbox_from_seed(s->support_mask, sw, sh, best_peak_x, best_peak_y, s->visited, s->bfs, &sx1, &sy1, &sx2, &sy2)
        || ((sx1 <= FB_BORDER_TOUCH_PX ? 1 : 0) + (sy1 <= FB_BORDER_TOUCH_PX ? 1 : 0)
            + (sx2 >= sw - 1 - FB_BORDER_TOUCH_PX ? 1 : 0) + (sy2 >= sh - 1 - FB_BORDER_TOUCH_PX ? 1 : 0)) >= 2) {
        double sup_thr = (double)peak * (double)FB_SUPPORT_PEAK_RATIO;
        for (int i = 0; i < total; i++) s->support_mask[i] = (double)s->score_map[i] >= sup_thr ? 1 : 0;
        if (!connected_bbox_from_seed(s->support_mask, sw, sh, best_peak_x, best_peak_y, s->visited, s->bfs, &sx1, &sy1, &sx2, &sy2)) {
            sx1 = best_bx1; sy1 = best_by1; sx2 = best_bx2; sy2 = best_by2;
        }
    }
    int support_span_w = sx2 - sx1 + 1, support_span_h = sy2 - sy1 + 1;
    int support_span = (support_span_w > support_span_h) ? support_span_w : support_span_h;
    double est_a = (double)(best_span_w > best_span_h ? best_span_w : best_span_h) * (double)FB_LOCAL_SIDE_SCALE;
    double est_b = (double)support_span * (double)FB_SUPPORT_SIDE_SCALE;
    long est_side = py_round_l(est_a > est_b ? est_a : est_b);
    if (component_side_frac <= (double)FB_FAR_SIDE_FRAC) est_side = py_round_l((double)est_side * (double)FB_FAR_SIDE_BOOST);
    if (component_side_frac >= (double)FB_CLOSE_SIDE_FRAC) est_side = py_round_l((double)est_side * (double)FB_CLOSE_SIDE_BOOST);
    int touch_left = (sx1 <= FB_BORDER_TOUCH_PX) ? 1 : 0;
    int touch_top = (sy1 <= FB_BORDER_TOUCH_PX) ? 1 : 0;
    int touch_right = (sx2 >= sw - 1 - FB_BORDER_TOUCH_PX) ? 1 : 0;
    int touch_bottom = (sy2 >= sh - 1 - FB_BORDER_TOUCH_PX) ? 1 : 0;
    if (touch_left || touch_top || touch_right || touch_bottom)
        est_side = py_round_l((double)est_side * (double)FB_BORDER_SIDE_BOOST);
    if (est_side < K) est_side = K;
    long min_side = py_round_l((double)(sh < sw ? sh : sw) * FB_MIN_SIDE_FRAC);
    if (est_side < min_side) est_side = min_side;
    long max_crop_side = (w < h) ? w : h;
    if (est_side > max_crop_side) est_side = max_crop_side;

    double sup_cx, sup_cy;
    weighted_center_in_bbox(s->target_map, sw, sh, sx1, sy1, sx2, sy2,
                            (double)(sx1 + sx2) * 0.5, (double)(sy1 + sy2) * 0.5,
                            &sup_cx, &sup_cy);
    double peak_cx = (double)best_peak_x, peak_cy = (double)best_peak_y;
    double close_ratio = (component_side_frac - (double)FB_CLOSE_SIDE_FRAC) / (0.40 - (double)FB_CLOSE_SIDE_FRAC);
    if (close_ratio < 0.0) close_ratio = 0.0;
    if (close_ratio > 1.0) close_ratio = 1.0;
    double bias_x = (double)FB_CENTER_BIAS_X * (1.0 - 0.75 * close_ratio);
    double bias_y = (double)FB_CENTER_BIAS_Y * (1.0 - 0.50 * close_ratio);
    double cx = ((double)FB_PEAK_CENTER_BLEND * peak_cx) + ((1.0 - (double)FB_PEAK_CENTER_BLEND) * (double)sup_cx);
    double cy = ((double)FB_PEAK_CENTER_BLEND * peak_cy) + ((1.0 - (double)FB_PEAK_CENTER_BLEND) * (double)sup_cy);
    cx += (double)est_side * (bias_x + (double)FB_BORDER_SHIFT_FRAC * (double)touch_right - (double)FB_BORDER_SHIFT_FRAC * (double)touch_left);
    cy += (double)est_side * (bias_y + (double)FB_BORDER_SHIFT_FRAC * (double)touch_bottom - (double)FB_BORDER_SHIFT_FRAC * (double)touch_top);
    double support_center_x = (double)(sx1 + sx2) * 0.5;
    double support_center_y = (double)(sy1 + sy2) * 0.5;
    double support_span_f = (double)((sx2 - sx1 + 1) > (sy2 - sy1 + 1) ? (sx2 - sx1 + 1) : (sy2 - sy1 + 1));
    double center_limit = 2.0;
    if (support_span_f * 0.5 > center_limit) center_limit = support_span_f * 0.5;
    if ((double)est_side * (double)FB_CENTER_CLAMP_FRAC > center_limit) center_limit = (double)est_side * (double)FB_CENTER_CLAMP_FRAC;
    if (cx < support_center_x - center_limit) cx = support_center_x - center_limit;
    if (cx > support_center_x + center_limit) cx = support_center_x + center_limit;
    if (cy < support_center_y - center_limit) cy = support_center_y - center_limit;
    if (cy > support_center_y + center_limit) cy = support_center_y + center_limit;
    cx += (double)left;
    cy += (double)top;
    if (est_side > max_crop_side) est_side = max_crop_side;
    long crop_left = py_round_l(cx - (double)est_side * 0.5);
    long crop_top = py_round_l(cy - (double)est_side * 0.5);
    if (crop_left < 0) crop_left = 0;
    if (crop_left > (long)w - est_side) crop_left = (long)w - est_side;
    if (crop_top < 0) crop_top = 0;
    if (crop_top > (long)h - est_side) crop_top = (long)h - est_side;
    out.x1 = (int)crop_left; out.y1 = (int)crop_top; out.x2 = (int)(crop_left + est_side); out.y2 = (int)(crop_top + est_side);
    return out;
}

// ── Exposure-adaptive band selection (host _focus_bbox_adaptive) ────────

SIGN_PP_NO_FMA
CropBox SignPreprocess::findSearchBoxAdaptive(const uint8_t* grayRaw, int w, int h) {
    Scratch* s = _scratch;
    if (!s || w * h > s->n) return findSearchBox(grayRaw, w, h);

    int left, right, top, bottom;
    fb_search_rect(w, h, &left, &right, &top, &bottom);
    const int sw = right - left, sh = bottom - top;
    const int total = sw * sh;
    if (total <= 0) return findSearchBox(grayRaw, w, h);

    memset(s->raw_hist, 0, sizeof(s->raw_hist));
    for (int y = 0; y < sh; y++)
        for (int x = 0; x < sw; x++)
            s->raw_hist[grayRaw[(top + y) * w + (left + x)]]++;

    // Length-11 box smoothing, zero-padded (np.convolve 'same').  numpy
    // multiplies each count by the kernel value 1/11 and accumulates — it
    // never sums-then-divides — and valley argmin compares adjacent smooth
    // values, so a 1-ulp difference flips near-tied valleys into different
    // candidate bands.  (Exact ties remain numpy-build-dependent.)
    const double kInv11 = 1.0 / 11.0;
    for (int i = 0; i < 256; i++) {
        double sum = 0.0;
        for (int k = 0; k < 11; k++) {
            int t = i + k - 5;
            if (t >= 0 && t < 256) sum += (double)s->raw_hist[t] * kInv11;
        }
        s->smooth[i] = sum;
    }

    int peaks[64]; int n_peaks = 0;
    for (int i = 2; i < 254; i++) {
        if (s->smooth[i] >= s->smooth[i - 1] && s->smooth[i] > s->smooth[i + 1]
            && s->smooth[i] >= 0.03 * (double)total / 8.0) {
            if (n_peaks < 64) peaks[n_peaks++] = i;
        }
    }
    if (n_peaks < 2) {
        n_peaks = 2;
        peaks[0] = percentile_linear_from_hist(s->raw_hist, total, 0.15);
        peaks[1] = percentile_linear_from_hist(s->raw_hist, total, 0.85);
    }

    int lo_arr[64], hi_arr[64]; int n_bands = 0;
    for (int k = 0; k + 1 < n_peaks; k++) {
        int a = peaks[k], b = peaks[k + 1];
        int best_i = a;
        double best_v = s->smooth[a];
        for (int i = a + 1; i <= b; i++) {
            if (s->smooth[i] < best_v) { best_v = s->smooth[i]; best_i = i; }
        }
        lo_arr[n_bands] = best_i; hi_arr[n_bands] = b; n_bands++;
    }
    {
        int p0 = peaks[0];
        int best_i = 0;
        double best_v = s->smooth[0];
        for (int i = 1; i <= p0; i++) {
            if (s->smooth[i] < best_v) { best_v = s->smooth[i]; best_i = i; }
        }
        lo_arr[n_bands] = 0;
        hi_arr[n_bands] = p0 + best_i;
        if (hi_arr[n_bands] <= 0) hi_arr[n_bands] = 100;
        n_bands++;
    }

    double best_score = -1.0;
    bool have_best = false;
    CropBox out = {0, 0, 0, 0};
    for (int k = 0; k < n_bands; k++) {
        int lo = lo_arr[k], hi = hi_arr[k];
        if (hi - lo < 10) continue;
        for (int i = 0; i < w * h; i++) {
            int v = grayRaw[i];
            s->band_gray[i] = (v > lo && v < hi) ? (uint8_t)v : 255;
        }
        CropBox box = findSearchBox(s->band_gray, w, h);
        int pad = 4;
        int ry1 = box.y1 - pad; if (ry1 < 0) ry1 = 0;
        int ry2 = box.y2 + pad; if (ry2 > h) ry2 = h;
        int rx1 = box.x1 - pad; if (rx1 < 0) rx1 = 0;
        int rx2 = box.x2 + pad; if (rx2 > w) rx2 = w;
        long cnt = 0, bcnt = 0;
        for (int y = ry1; y < ry2; y++) {
            for (int x = rx1; x < rx2; x++) {
                if (x >= box.x1 && x < box.x2 && y >= box.y1 && y < box.y2) continue;
                cnt++;
                if (grayRaw[y * w + x] >= 180) bcnt++;
            }
        }
        double ring = cnt > 0 ? (double)bcnt / (double)cnt : 0.0;
        if (ring < 0.35) continue;
        double score = ring * (double)(box.x2 - box.x1);
        if (!have_best || score > best_score) {
            best_score = score;
            out = box;
            have_best = true;
        }
    }
    if (have_best) return out;
    return findSearchBox(grayRaw, w, h);
}

CropBox SignPreprocess::findSignCrop(const uint8_t* gChannel, int w, int h, int dark, int lum) {
    Scratch* s = _scratch;
    if (!s || w * h > s->n) return fb_fallback(w, h);
    if (dark != 0 || lum != 100) {
        // Tuned thresholds: mask first (non-sign -> white), then the classic
        // focus search — the host's tuned branch.
        for (int i = 0; i < w * h; i++) {
            int v = gChannel[i];
            s->band_gray[i] = (v > dark && v < lum) ? (uint8_t)v : 255;
        }
        return findSearchBox(s->band_gray, w, h);
    }
    return findSearchBoxAdaptive(gChannel, w, h);
}

CropBox SignPreprocess::junctionCrop(int w, int h) {
    // Host _junction_bbox: 40–75 % height strip, full width.
    int top = (int)py_round_d((double)h * 0.40);
    if (top < 0) top = 0; if (top > h - 1) top = h - 1;
    int bottom = (int)py_round_d((double)h * 0.75);
    if (bottom < top + 1) bottom = top + 1; if (bottom > h) bottom = h;
    return CropBox{0, top, w, bottom};
}

CropBox SignPreprocess::manualCrop(const float roi[4], int w, int h) {
    // Host manual_roi_to_pixels (normalized x1,y1,x2,y2).
    int px1 = (int)py_round_d((double)roi[0] * w);
    int py1 = (int)py_round_d((double)roi[1] * h);
    int px2 = (int)py_round_d((double)roi[2] * w);
    int py2 = (int)py_round_d((double)roi[3] * h);
    if (px1 < 0) px1 = 0; if (px1 > w - 1) px1 = w - 1;
    if (py1 < 0) py1 = 0; if (py1 > h - 1) py1 = h - 1;
    if (px2 < px1 + 1) px2 = px1 + 1; if (px2 > w) px2 = w;
    if (py2 < py1 + 1) py2 = py1 + 1; if (py2 > h) py2 = h;
    return CropBox{px1, py1, px2, py2};
}

// ── Bilinear crop-resize (PIL Image.BILINEAR) ───────────────────────────

SIGN_PP_NO_FMA
void SignPreprocess::cropResizeBilinearRgb(const uint8_t* rgb, int w, int h,
                                           const CropBox& box, int outW, int outH,
                                           int8_t* out) const {
    const int bw = box.x2 - box.x1;
    const int bh = box.y2 - box.y1;
    if (bw <= 0 || bh <= 0) return;
    for (int y = 0; y < outH; y++) {
        float fy = (float)(y + 0.5) * (float)bh / (float)outH - 0.5f;
        int y0 = (int)floorf(fy);
        if (y0 < 0) y0 = 0;
        int y1 = y0 + 1;
        if (y1 >= bh) y1 = bh - 1;
        float wy = fy - (float)y0;
        for (int x = 0; x < outW; x++) {
            float fx = (float)(x + 0.5) * (float)bw / (float)outW - 0.5f;
            int x0 = (int)floorf(fx);
            if (x0 < 0) x0 = 0;
            int x1 = x0 + 1;
            if (x1 >= bw) x1 = bw - 1;
            float wx = fx - (float)x0;

            int i00 = ((box.y1 + y0) * w + (box.x1 + x0)) * 3;
            int i10 = ((box.y1 + y0) * w + (box.x1 + x1)) * 3;
            int i01 = ((box.y1 + y1) * w + (box.x1 + x0)) * 3;
            int i11 = ((box.y1 + y1) * w + (box.x1 + x1)) * 3;

            float r = (1.0f - wx) * (1.0f - wy) * (float)rgb[i00 + 0] + wx * (1.0f - wy) * (float)rgb[i10 + 0]
                    + (1.0f - wx) * wy * (float)rgb[i01 + 0] + wx * wy * (float)rgb[i11 + 0];
            float g = (1.0f - wx) * (1.0f - wy) * (float)rgb[i00 + 1] + wx * (1.0f - wy) * (float)rgb[i10 + 1]
                    + (1.0f - wx) * wy * (float)rgb[i01 + 1] + wx * wy * (float)rgb[i11 + 1];
            float b = (1.0f - wx) * (1.0f - wy) * (float)rgb[i00 + 2] + wx * (1.0f - wy) * (float)rgb[i10 + 2]
                    + (1.0f - wx) * wy * (float)rgb[i01 + 2] + wx * wy * (float)rgb[i11 + 2];

            // Negative border weights can extrapolate past [0,255] — the
            // host clips after flooring; a bare uint8_t cast would wrap.
            float lumf = (r * 30.0f + g * 59.0f + b * 11.0f) / 100.0f + 0.5f;
            int lum = (int)floorf(lumf);
            if (lum < 0) lum = 0; if (lum > 255) lum = 255;
            out[y * outW + x] = (int8_t)(lum - 128);
        }
    }
}

SIGN_PP_NO_FMA
void SignPreprocess::cropResizeBilinearGray(const uint8_t* gray, int w, int h,
                                            const CropBox& box, int outW, int outH,
                                            int8_t* out) const {
    const int bw = box.x2 - box.x1;
    const int bh = box.y2 - box.y1;
    if (bw <= 0 || bh <= 0) return;
    for (int y = 0; y < outH; y++) {
        float fy = (float)(y + 0.5) * (float)bh / (float)outH - 0.5f;
        int y0 = (int)floorf(fy);
        if (y0 < 0) y0 = 0;
        int y1 = y0 + 1;
        if (y1 >= bh) y1 = bh - 1;
        float wy = fy - (float)y0;
        for (int x = 0; x < outW; x++) {
            float fx = (float)(x + 0.5) * (float)bw / (float)outW - 0.5f;
            int x0 = (int)floorf(fx);
            if (x0 < 0) x0 = 0;
            int x1 = x0 + 1;
            if (x1 >= bw) x1 = bw - 1;
            float wx = fx - (float)x0;

            float v = (1.0f - wx) * (1.0f - wy) * (float)gray[(box.y1 + y0) * w + (box.x1 + x0)]
                    + wx * (1.0f - wy) * (float)gray[(box.y1 + y0) * w + (box.x1 + x1)]
                    + (1.0f - wx) * wy * (float)gray[(box.y1 + y1) * w + (box.x1 + x0)]
                    + wx * wy * (float)gray[(box.y1 + y1) * w + (box.x1 + x1)];
            // Same float-op order as the RGB variant's BT.601 (r=g=b=v here),
            // so grayscale sources stay bit-identical to the host pipeline.
            float lumf = (v * 30.0f + v * 59.0f + v * 11.0f) / 100.0f + 0.5f;
            int lum = (int)floorf(lumf);
            if (lum < 0) lum = 0; if (lum > 255) lum = 255;
            out[y * outW + x] = (int8_t)(lum - 128);
        }
    }
}

SIGN_PP_NO_FMA
void SignPreprocess::cropResizePadBilinearGray(const uint8_t* gray, int w, int h,
                                               const CropBox& box, int outSide,
                                               int8_t* out) const {
    // Letterbox: scale the crop to fit inside outSide x outSide, centered on
    // black — the host junction path (ImageOps.pad, color=0, centered).
    const int bw = box.x2 - box.x1;
    const int bh = box.y2 - box.y1;
    if (bw <= 0 || bh <= 0) return;
    const float scale = (float)((bw > bh ? bw : bh)) / (float)outSide;  // fit the LARGER dim
    const int dw = (int)py_round_d((double)bw / (double)scale);
    const int dh = (int)py_round_d((double)bh / (double)scale);
    const int offX = (outSide - dw) / 2;
    const int offY = (outSide - dh) / 2;
    memset(out, -128, (size_t)outSide * outSide);
    for (int y = 0; y < dh; y++) {
        float fy = (float)(y + 0.5) * (float)bh / (float)dh - 0.5f;
        int y0 = (int)floorf(fy);
        if (y0 < 0) y0 = 0;
        int y1 = y0 + 1;
        if (y1 >= bh) y1 = bh - 1;
        float wy = fy - (float)y0;
        for (int x = 0; x < dw; x++) {
            float fx = (float)(x + 0.5) * (float)bw / (float)dw - 0.5f;
            int x0 = (int)floorf(fx);
            if (x0 < 0) x0 = 0;
            int x1 = x0 + 1;
            if (x1 >= bw) x1 = bw - 1;
            float wx = fx - (float)x0;
            float v = (1.0f - wx) * (1.0f - wy) * (float)gray[(box.y1 + y0) * w + (box.x1 + x0)]
                    + wx * (1.0f - wy) * (float)gray[(box.y1 + y0) * w + (box.x1 + x1)]
                    + (1.0f - wx) * wy * (float)gray[(box.y1 + y1) * w + (box.x1 + x0)]
                    + wx * wy * (float)gray[(box.y1 + y1) * w + (box.x1 + x1)];
            float lumf = (v * 30.0f + v * 59.0f + v * 11.0f) / 100.0f + 0.5f;
            int lum = (int)floorf(lumf);
            if (lum < 0) lum = 0; if (lum > 255) lum = 255;
            out[(offY + y) * outSide + (offX + x)] = (int8_t)(lum - 128);
        }
    }
}

SIGN_PP_NO_FMA
void SignPreprocess::cropResizePadBilinearRgb(const uint8_t* rgb, int w, int h,
                                              const CropBox& box, int outSide,
                                              int8_t* out) const {
    const int bw = box.x2 - box.x1;
    const int bh = box.y2 - box.y1;
    if (bw <= 0 || bh <= 0) return;
    const float scale = (float)((bw > bh ? bw : bh)) / (float)outSide;
    const int dw = (int)py_round_d((double)bw / (double)scale);
    const int dh = (int)py_round_d((double)bh / (double)scale);
    const int offX = (outSide - dw) / 2;
    const int offY = (outSide - dh) / 2;
    memset(out, -128, (size_t)outSide * outSide);
    for (int y = 0; y < dh; y++) {
        float fy = (float)(y + 0.5) * (float)bh / (float)dh - 0.5f;
        int y0 = (int)floorf(fy);
        if (y0 < 0) y0 = 0;
        int y1 = y0 + 1;
        if (y1 >= bh) y1 = bh - 1;
        float wy = fy - (float)y0;
        for (int x = 0; x < dw; x++) {
            float fx = (float)(x + 0.5) * (float)bw / (float)dw - 0.5f;
            int x0 = (int)floorf(fx);
            if (x0 < 0) x0 = 0;
            int x1 = x0 + 1;
            if (x1 >= bw) x1 = bw - 1;
            float wx = fx - (float)x0;

            int i00 = ((box.y1 + y0) * w + (box.x1 + x0)) * 3;
            int i10 = ((box.y1 + y0) * w + (box.x1 + x1)) * 3;
            int i01 = ((box.y1 + y1) * w + (box.x1 + x0)) * 3;
            int i11 = ((box.y1 + y1) * w + (box.x1 + x1)) * 3;
            float r = (1.0f - wx) * (1.0f - wy) * (float)rgb[i00 + 0] + wx * (1.0f - wy) * (float)rgb[i10 + 0]
                    + (1.0f - wx) * wy * (float)rgb[i01 + 0] + wx * wy * (float)rgb[i11 + 0];
            float g = (1.0f - wx) * (1.0f - wy) * (float)rgb[i00 + 1] + wx * (1.0f - wy) * (float)rgb[i10 + 1]
                    + (1.0f - wx) * wy * (float)rgb[i01 + 1] + wx * wy * (float)rgb[i11 + 1];
            float b = (1.0f - wx) * (1.0f - wy) * (float)rgb[i00 + 2] + wx * (1.0f - wy) * (float)rgb[i10 + 2]
                    + (1.0f - wx) * wy * (float)rgb[i01 + 2] + wx * wy * (float)rgb[i11 + 2];
            float lumf = (r * 30.0f + g * 59.0f + b * 11.0f) / 100.0f + 0.5f;
            int lum = (int)floorf(lumf);
            if (lum < 0) lum = 0; if (lum > 255) lum = 255;
            out[(offY + y) * outSide + (offX + x)] = (int8_t)(lum - 128);
        }
    }
}

void SignPreprocess::contrastStretchInt8(int8_t* img, int n) {
    uint8_t min_val = 255, max_val = 0;
    for (int i = 0; i < n; i++) {
        uint8_t v = (uint8_t)((int)img[i] + 128);
        if (v < min_val) min_val = v;
        if (v > max_val) max_val = v;
    }
    int span = (int)max_val - (int)min_val;
    if (span >= 24) {
        for (int i = 0; i < n; i++) {
            uint8_t v = (uint8_t)((int)img[i] + 128);
            int stretched = (((int)v - (int)min_val) * 255 + span / 2) / span;
            img[i] = (int8_t)(stretched - 128);
        }
    }
}

} // namespace TFLiteVision
