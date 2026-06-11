<p align="center">
  <a href="https://mixly3.gitee.io/mixly3.0_src">
    <img src="https://foruda.gitee.com/images/1677155717148882961/0c044ac0_5225463.png" width="100" alt="Mixly">
  </a>
</p>
<h2 align="center">Mixly Lite — AIoScout Fork</h2>

Fork of [mixly/mixly_lite](https://github.com/mixly/mixly_lite) with SmartCar blocks, AI Vision (TFLite), and a compile/upload backend.

---

## Features

### 🚗 SmartCar Blocks
Motor, servo, IR sensor, ultrasonic, RFID, buzzer, Firebase, PID, IMU — for ESP32 IoT Smart Car.

### 🤖 AI Vision (TFLite)
Block-based AI image classification using TensorFlow Lite. Dual-board architecture:

- **AI Eye (ESP32-P4)** — IMX219 MIPI CSI-2 camera + TFLite inference + sends results over UART
- **AI Body (ESP32-S3)** — receives AI results over UART + controls motors/etc.

Children use the same blocks regardless of board role. UART communication is hidden inside the C++ library.

| Block | Description |
|-------|-------------|
| Initialize AI Eye | P4: camera + model + UART transmitter |
| Initialize AI Body | S3: UART receiver |
| Load AI Model | Upload .tflite model + labels |
| AI Prediction | Get label / class index / confidence |
| Number of Classes | Get model class count |
| Has New AI Result | Check for new result from partner board |
| Send AI Result | Explicitly send to partner (auto-sent by default) |
| Set Communication Pins | Set UART TX/RX pins (default 43/44) |

### 💾 File Save/Load
- **Ctrl+S** — Save As (.mix) first time, then saves to same file
- **Ctrl+O** — Open .mix file
- **Drag-drop** — Drop .mix/.xml files to load
- **Auto-save** — Every 30s after first save

---

## Quick Start

```bash
# Install dependencies
npm install

# Build Arduino board package
npm run build:boards:arduino

# Initialize ESP32-P4 IMX219 submodule (for P4 support)
git submodule update --init

# Start server (frontend + compile/upload backend)
node server.js
```

Open http://localhost:3000

**Requirements:**
- `arduino-cli` in PATH
- ESP32 board package installed (`arduino-cli core install esp32:esp32`)
- For AI Vision: `arduino-cli lib install TensorFlowLiteESP32`

---

## Project Structure

```
mixly_lite/
├── SmartCar/                          # SmartCar C++ library (Arduino 1.5)
│   └── src/SmartCar/                  # MotorControl, Movement, IRSensors, etc.
├── Mixly_TFLite/                      # TFLite C++ library
│   └── src/Mixly_TFLite/
│       ├── AIVision.hpp/cpp           # Unified API (InitEye/InitBody/Predict)
│       ├── TFLiteEngine.hpp/cpp       # TFLite interpreter (int8 + float)
│       ├── CameraCapture.hpp/cpp      # P4 (IMX219) / S3 (OV-series) camera
│       ├── ImagePreprocessor.hpp/cpp  # RGB565→float, grayscale→int8
│       ├── P4IMX219.hpp/cpp           # ESP32-P4 MIPI CSI-2 driver
│       ├── UARTBridge.hpp/cpp         # P4→S3 UART protocol
│       └── model_data.h              # Auto-generated from uploaded .tflite
├── ESP32-P4-IMX219-PoC/              # Submodule: IMX219 camera driver
├── server.js                          # Node.js backend (compile/upload/model upload)
├── common/smartcar-plugin.js          # Frontend: buttons, file manager, WebSocket
├── programs/                          # Example Mixly programs
│   ├── p4_ai_eye.xml
│   └── s3_ai_body.xml
└── boards/default_src/arduino_esp32/  # Block definitions & code generators
    ├── blocks/TFLiteVision.js
    ├── generators/TFLiteVision.js
    ├── blocks/SmartCar.js
    ├── generators/SmartCar.js
    └── origin/xml/esp32.xml
```

---

## AI Vision Setup

### Hardware Wiring (P4 ↔ S3)
```
P4 TX (GPIO 43) → S3 RX (GPIO 44)
P4 RX (GPIO 44) ← S3 TX (GPIO 43)
Common GND
```

### Workflow
1. Train a model using [AItraining](https://github.com/koilkl/Aitraining) or Google Teachable Machine
2. Export as int8 quantized .tflite (96×96 grayscale)
3. In Mixly: build P4 program (AI Eye) → select P4 board → upload
4. In Mixly: build S3 program (AI Body) → select S3 board → upload
5. P4 captures images, runs inference, sends results to S3 over UART
6. S3 receives labels + confidence and drives motors, LEDs, etc.

### ESP32-P4 Additional Setup
Requires the custom P4 Arduino core. See `arduino/CORE_REBUILD.md` in the [Teachable Machine repo](https://github.com/AIoScout/Google-Teachable-Machine-TFLite-model-training).

---

## How to Create Custom Blocks

See [Custom Blocks Guide](#) — the existing `SmartCar.js` and `TFLiteVision.js` serve as reference implementations.

### Key Files
```
boards/default_src/arduino_esp32/
├── blocks/YourFeature.js       # Block visual definitions (export const block_name = { init() {} })
├── generators/YourFeature.js   # Code generators (export const block_name = function(_, generator) {})
├── export.js                   # Import and re-export
├── index.js                    # Register to Blockly.Blocks and Blockly.Arduino.forBlock
└── origin/xml/esp32.xml        # Toolbox (<block type="block_name">)
```

### Block Pattern
```javascript
// blocks/YourFeature.js
export const my_block = {
    init: function () {
        this.setColour('#FF6F00');
        this.appendDummyInput().appendField("do something");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
    }
};

// generators/YourFeature.js
export const my_block = function (_, generator) {
    generator.definitions_['include_lib'] = '#include "MyLib.hpp"';
    generator.setups_['my_init'] = '  MyLib::Init();\n';
    return 'MyLib::DoSomething();\n';
};
```

---

## License

MIT
