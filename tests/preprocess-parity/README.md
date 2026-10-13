# SignPreprocess host-parity harness

Verifies the Mixly_TFLite device crop pipeline stays bit-identical to the
AItraining host pipeline (`image_preprocess.py`). Run before changing
`Mixly_TFLite/src/Mixly_TFLite/SignPreprocess.cpp`.

```bash
cd tests/preprocess-parity # Arduino.h shim included
cp ../../Mixly_TFLite/src/Mixly_TFLite/SignPreprocess.{hpp,cpp} .
g++ -O2 -ffp-contract=off -std=c++17 -I. test_main.cpp SignPreprocess.cpp -o pp_test
/path/to/AItraining/.venv/bin/python parity.py
```

`-ffp-contract=off` is required on the host build (clang has no per-function
`optimize` attribute); the ESP32 GCC build is guarded by `SIGN_PP_NO_FMA`.

Reference (2026-10-13, 100 frames): sign tuned 100/100, manual 100/100,
junction 100/100 bit-identical; adaptive 99/100 (one tied histogram valley).
