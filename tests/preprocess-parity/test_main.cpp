// Parity-test driver: gray frame in, pipeline out.
// usage: pp_test <frame.bin> <size> <mode> <dark> <lum> <out.bin> <boxout.txt>
#include "Arduino.h"
#include "SignPreprocess.hpp"
#include <vector>
#include <string>
using namespace TFLiteVision;

int main(int argc, char** argv) {
    if (argc < 8) { fprintf(stderr, "args\n"); return 2; }
    const std::string framePath = argv[1];
    const int size = atoi(argv[2]);
    const int mode = atoi(argv[3]);
    const int dark = atoi(argv[4]);
    const int lum = atoi(argv[5]);
    const std::string outPath = argv[6];
    const std::string boxPath = argv[7];

    FILE* f = fopen(framePath.c_str(), "rb");
    if (!f) { perror("frame"); return 2; }
    std::vector<uint8_t> gray((size_t)size * size);
    if (fread(gray.data(), 1, gray.size(), f) != gray.size()) { fprintf(stderr, "short read\n"); return 2; }
    fclose(f);

    SignPreprocess pp;
    if (!pp.begin(size)) { fprintf(stderr, "scratch alloc failed\n"); return 3; }

    CropBox box;
    if (mode == 1) box = pp.findSignCrop(gray.data(), size, size, dark, lum);
    else if (mode == 2) box = SignPreprocess::junctionCrop(size, size);
    else if (argc >= 12) { float roi[4] = {(float)atof(argv[8]), (float)atof(argv[9]), (float)atof(argv[10]), (float)atof(argv[11])}; box = SignPreprocess::manualCrop(roi, size, size); }
    else { float roi[4] = {0.1f, 0.2f, 0.9f, 0.8f}; box = SignPreprocess::manualCrop(roi, size, size); }

    std::vector<int8_t> out((size_t)size * size);
    if (mode == 2) pp.cropResizePadBilinearGray(gray.data(), size, size, box, size, out.data());
    else pp.cropResizeBilinearGray(gray.data(), size, size, box, size, size, out.data());
    SignPreprocess::contrastStretchInt8(out.data(), (int)out.size());

    f = fopen(outPath.c_str(), "wb");
    fwrite(out.data(), 1, out.size(), f);
    fclose(f);
    f = fopen(boxPath.c_str(), "w");
    fprintf(f, "%d %d %d %d\n", box.x1, box.y1, box.x2, box.y2);
    fclose(f);
    return 0;
}
