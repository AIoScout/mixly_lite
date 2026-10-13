"""C++ vs Python bit-parity test for the SignPreprocess port.

Setup: copy Mixly_TFLite/src/Mixly_TFLite/SignPreprocess.{hpp,cpp} next to
this script, place the Arduino host shim in Arduino.h, then:

    g++ -O2 -ffp-contract=off -std=c++17 -I. test_main.cpp SignPreprocess.cpp -o pp_test
    <AItraining>/.venv/bin/python parity.py

Expects the AItraining repo (host reference) at the path below.
"""
import subprocess, sys, os
import numpy as np
sys.path.insert(0, "/Users/agoo/projects/aioscout/Google-Teachable-Machine-TFLite-model-training/AItraining")
os.environ.setdefault("TFLITE_TRAINING_DATA_DIR", "/tmp/pp_test/data")
from image_preprocess import preprocess_blue_diff_array, manual_roi_to_pixels

SIZE = 96
BIN = "/tmp/pp_test/pp_test"
rng = np.random.RandomState(42)

def synth_frame():
    """White-ish paper bg + dark sign square + mild noise/shadow."""
    f = rng.randint(205, 245, size=(SIZE, SIZE)).astype(np.uint8)
    # shadow band
    if rng.rand() < 0.5:
        y0 = rng.randint(0, SIZE - 20)
        h = rng.randint(6, 18)
        f[y0:y0 + h, :] = np.clip(f[y0:y0 + h, :].astype(int) - rng.randint(30, 70), 0, 255).astype(np.uint8)
    # the sign
    sw = rng.randint(18, 46)
    x0 = rng.randint(8, SIZE - sw - 8)
    y0 = rng.randint(8, SIZE - sw - 8)
    sign = rng.randint(35, 95, size=(sw, sw)).astype(np.uint8)
    f[y0:y0 + sw, x0:x0 + sw] = sign
    # border ring slightly brighter
    f[max(0,y0-2):y0, x0:x0+sw] = np.clip(f[max(0,y0-2):y0, x0:x0+sw].astype(int) + 10, 0, 255).astype(np.uint8)
    return f

def run_cpp(gray, mode, dark, lum):
    open("/tmp/pp_test/frame.bin", "wb").write(gray.tobytes())
    r = subprocess.run([BIN, "/tmp/pp_test/frame.bin", str(SIZE), str(mode), str(dark), str(lum),
                        "/tmp/pp_test/out.bin", "/tmp/pp_test/box.txt"], capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.decode())
    out = np.frombuffer(open("/tmp/pp_test/out.bin", "rb").read(), dtype=np.int8).reshape(SIZE, SIZE)
    box = tuple(int(v) for v in open("/tmp/pp_test/box.txt").read().split())
    return box, out

def py_pipeline(gray, dark, lum, roi=None):
    res = preprocess_blue_diff_array(gray, SIZE, roi=roi, bg_dark_thresh=dark, bg_lum_thresh=lum,
                                     return_crop_box=True)
    image, crop_norm = res[0], res[1]
    x1, y1, x2, y2 = crop_norm
    box = (int(round(x1 * SIZE)), int(round(y1 * SIZE)), int(round(x2 * SIZE)), int(round(y2 * SIZE)))
    u8 = np.clip(np.round(image[:, :, 0] * 255.0), 0, 255).astype(np.uint8)
    return box, u8

def compare(name, cases):
    total = len(cases); box_ok = byte_ok = 0; max_lsb = 0; byte_mismatch_worst = None
    for gray, mode, dark, lum, py in cases:
        cbox, cout = run_cpp(gray, mode, dark, lum)
        pbox, pu8 = py
        if cbox == pbox: box_ok += 1
        cu8 = (cout.astype(np.int16) + 128).astype(np.uint8)
        diff = np.abs(cu8.astype(int) - pu8.astype(int))
        if diff.max() == 0: byte_ok += 1
        else:
            max_lsb = max(max_lsb, int(diff.max()))
            frac = float((diff > 0).mean())
            if byte_mismatch_worst is None or frac > byte_mismatch_worst[0]:
                byte_mismatch_worst = (frac, cbox, pbox)
    print(f"{name}: boxes {box_ok}/{total} identical | tensors {byte_ok}/{total} bit-identical"
          + (f" | worst {max_lsb} LSB on {byte_mismatch_worst[0]*100:.1f}% px, boxes c={byte_mismatch_worst[1]} p={byte_mismatch_worst[2]}" if byte_ok < total else ""))

frames = [synth_frame() for _ in range(100)]

tuned = [(g, 1, 12, 150, py_pipeline(g, 12, 150)) for g in frames]
adaptive = [(g, 1, 0, 100, py_pipeline(g, 0, 100)) for g in frames]
manual_roi = (0.1, 0.2, 0.9, 0.8)
manual = [(g, 3, 0, 100, py_pipeline(g, 0, 100, roi=manual_roi_to_pixels(SIZE, SIZE, manual_roi))) for g in frames]
from image_preprocess import preprocess_array
def py_junction(g):
    img = preprocess_array(g, SIZE, clip_mode=1)  # CLIP_MODE_JUNCTION
    u8 = np.clip(np.round(img[:, :, 0] * 255.0), 0, 255).astype(np.uint8)
    return (0, 38, 96, 72), u8
junction = [(g, 2, 0, 100, py_junction(g)) for g in frames]

compare("sign tuned (12/150) ", tuned)
compare("sign adaptive (0/100)", adaptive)
compare("manual ROI           ", manual)
compare("junction              ", junction)
