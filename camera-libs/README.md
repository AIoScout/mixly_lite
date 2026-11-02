# camera-libs — drop-in camera Arduino libraries (not committed)

The AI Eye (P4) sign/plate firmware burn (`Flash P4 AI Eye` button)
compiles Koil's `TFLite_Sign` sketch, whose camera layer needs the
private Arduino libraries from Koil:

- `ESP32_P4_IMX219/`   (folder with library.properties / src)
- `ESP32_P4_OV5647/`

Copy both folders here (or directly into the server's libraries dir). The
server auto-deploys them into its Arduino libraries directory on each P4
burn. Without them the burn stops with a clear error before compiling.

Upstreaming note: mixly's own `Mixly_TFLite/P4IMX219.cpp` carries an
esp_video fallback for its AI Eye blocks, but the sign sketch's
preprocessing parity (gray conversion matching the training data) is
tuned against Koil's libraries — do not substitute them casually.
