<p align="center">
  <a href="https://mixly3.gitee.io/mixly3.0_src">
    <img src="https://foruda.gitee.com/images/1677155717148882961/0c044ac0_5225463.png" width="100" alt="Mixly">
  </a>
</p>
<h2 align="center">Mixly-lite (ISD-IoT Fork)</h2>

Original Repo: https://github.com/mixly/mixly_lite

---

## SmartCar Custom Blocks

This fork adds custom block modules for the **ESP32 IoT Smart Car** project, supporting the following boards:
- **Arduino ESP32** (C++ code generation)
- **MicroPython ESP32-S3** (MicroPython code generation)

### Available Blocks

| Category | Blocks | Description |
|----------|--------|-------------|
| **Motors** | move_forward, move_backward, rotate_left, rotate_right, stop | Motor control |
| **Motors** | set_speed | Motor speed control |
| **IR Sensors** | read_ir_left, read_ir_middle, read_ir_right | IR sensor reading |
| **IR Sensors** | get_track_state | Get line-tracking state |
| **Ultrasonic** | get_distance_cm | Ultrasonic distance measurement |
| **RFID** | read_rfid_tag, has_new_tag | RFID tag reading |
| **Buzzer** | play_tone, buzzer_stop | Buzzer control |
| **Firebase** | is_exam_activated, get_traffic_light_state, get_time_remain | Firebase cloud communication |
| **PID Control** | set_pid_gains, get_left_rpm, get_right_rpm, set_target_rpm | PID speed control |

### Code Generation Examples

**Arduino ESP32:**
```cpp
#include "SmartCar/Movement.hpp"
Movement::MoveForward();
```

**MicroPython ESP32-S3:**
```python
from smartcar import Movement
Movement.move_forward()
```

## Running Locally

### Static File Server (Frontend only)

```bash
python3 serve.py
```
Then open http://localhost:3000

### Full Backend (Compile + Upload)

For browser-based compile and upload to ESP32, start the Node.js WebSocket backend:

```bash
# Install dependencies (first time)
npm install

# Start the server
node server.js
```

Then open http://localhost:3000 in your browser. The Mixly toolbar will show **编译** (Compile) and **上传** (Upload) buttons.

Requirements:
- `arduino-cli` installed and available in `PATH`
- ESP32 board package installed in `arduino-cli`

## Build Commands

```bash
# Install dependencies (first time)
npm install

# Build all Arduino boards
npm run build:boards:arduino

# Build all boards
npm run build:boards:all

# Start local server
python3 serve.py
```

## Project Structure

```
mixly_lite/
├── SmartCar/                          # SmartCar C++ library (Arduino 1.5 format)
│   ├── library.properties             # Library metadata for arduino-cli
│   ├── src/
│   │   ├── SmartCar.h                 # Discovery header (includes all modules)
│   │   └── SmartCar/
│   │       ├── MotorControl.hpp/cpp   # DC motor control
│   │       ├── Movement.hpp/cpp       # High-level movement commands
│   │       ├── IRSensors.hpp/cpp      # IR sensor reading & state detection
│   │       ├── UltrasonicSensor.hpp/cpp
│   │       ├── RFIDReader.hpp/cpp     # MFRC522 RFID reader (I2C)
│   │       ├── MFRC522_I2C.hpp/cpp    # MFRC522 I2C driver
│   │       ├── Buzzer.hpp/cpp         # Buzzer control
│   │       ├── Pinout.hpp             # GPIO pin definitions
│   │       ├── registers.h            # MFRC522 register definitions
│   │       └── pitches.h              # Musical note definitions
├── server.js                          # Node.js WebSocket backend (compile/upload)
├── common/smartcar-plugin.js          # Frontend plugin for compile/upload buttons
├── boards/default_src/arduino_esp32/  # Arduino ESP32 board package
│   ├── blocks/SmartCar.js             # Block visual definitions
│   ├── generators/SmartCar.js         # C++ code generators
│   ├── blocks/control.js              # FreeRTOS task blocks
│   ├── generators/control.js          # FreeRTOS task generators
│   └── origin/xml/esp32.xml           # Toolbox configuration
└── boards/default_src/micropython_esp32s3/  # MicroPython ESP32-S3 package
    ├── blocks/SmartCar.js
    └── generators/SmartCar.js
```

### FreeRTOS Support

The ESP32 board includes built-in FreeRTOS multitasking blocks:
- Create up to 8 concurrent tasks
- Assign tasks to Core 0 (WiFi/networking) or Core 1 (robot control)
- Configurable priority (1-4) and stack size

### Using SmartCar Library

The `SmartCar/` folder is packaged as an **Arduino 1.5 library**. When using `server.js`, it is automatically copied to the `libraries/` directory and linked during compile/upload. The generated code uses:

```cpp
#include <SmartCar.h>
#include "SmartCar/Movement.hpp"
#include "SmartCar/IRSensors.hpp"
```

If you are compiling manually with `arduino-cli`, use the `--libraries` flag:

```bash
arduino-cli compile -b esp32:esp32:esp32 --libraries ./libraries ./sketch_build
```

---

## How to Create Custom Blocks

### File Structure

```
boards/default_src/<board_type>/
├── blocks/           # Define block appearance
│   └── YourBlock.js
├── generators/       # Define code generation
│   └── YourBlock.js
├── export.js         # Export modules
├── index.js          # Register to Blockly
└── template.xml      # Toolbox categories
```

### 1. Define Block (Visual Appearance)

In `blocks/YourBlock.js`:

```javascript
// Simple statement block (no parameters)
export const my_block = {
  init: function() {
    this.appendDummyInput()
        .appendField("move forward");
    this.setPreviousStatement(true);   // Connectable at top
    this.setNextStatement(true);       // Connectable at bottom
    this.setColour(290);               // Color (0-360)
  }
};

// Block with number parameter
export const my_speed_block = {
  init: function() {
    this.appendDummyInput()
        .appendField("set speed")
        .appendField(new Blockly.FieldNumber(50), "SPEED");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(290);
  }
};

// Block with dropdown
export const my_servo_block = {
  init: function() {
    this.appendDummyInput()
        .appendField("set servo")
        .appendField(new Blockly.FieldDropdown([
          ["Left", "LEFT"],
          ["Right", "RIGHT"]
        ]), "SERVO")
        .appendField("angle")
        .appendField(new Blockly.FieldNumber(90, 0, 180), "ANGLE");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(290);
  }
};

// Value block (expression - returns a value)
export const my_value_block = {
  init: function() {
    this.appendDummyInput()
        .appendField("distance (cm)");
    this.setOutput(true, "Number");  // Has output
    this.setColour(290);
  }
};
```

### 2. Define Generator (Code Generation)

In `generators/YourBlock.js`:

```javascript
// Simple statement block
export const my_block = function (_, generator) {
    // Add import (only once, deduplicated by key)
    generator.definitions_['import_movement'] = 'from smartcar import Movement';

    // Add initialization code (only once)
    generator.definitions_['init_motors'] = 'Movement.init_motors()';

    // Return generated code (must end with \n for statements)
    return 'Movement.move_forward()\n';
};

// Block with parameters
export const my_speed_block = function (_, generator) {
    // Get parameter value
    const speed = this.getFieldValue('SPEED');

    generator.definitions_['import_movement'] = 'from smartcar import Movement';

    return `Movement.set_speed(${speed})\n`;
};

// Block with dropdown
export const my_servo_block = function (_, generator) {
    const servo = this.getFieldValue('SERVO');  // "LEFT" or "RIGHT"
    const angle = this.getFieldValue('ANGLE');

    generator.definitions_['import_movement'] = 'from smartcar import Movement';

    return `Movement.set_servo("${servo}", ${angle})\n`;
};

// Value block (expression)
export const my_value_block = function (_, generator) {
    generator.definitions_['import_ultrasonic'] = 'from smartcar import Ultrasonic';

    // Return [code, precedence]
    return ['Ultrasonic.get_distance_cm()', generator.ORDER_ATOMIC];
};
```

### 3. Register Module

In `export.js`:
```javascript
import * as YourBlockBlocks from './blocks/YourBlock';
import * as YourBlockGenerators from './generators/YourBlock';

export {
    YourBlockBlocks,
    YourBlockGenerators
};
```

In `index.js`:
```javascript
import { YourBlockBlocks, YourBlockGenerators } from './export';

Object.assign(Blockly.Blocks, YourBlockBlocks);
Object.assign(Blockly.Python.forBlock, YourBlockGenerators);
```

### 4. Add to Toolbox

In `template.xml`:
```xml
<category id="catYourCategory" name="YourCategory" colour="290">
  <block type="my_block"></block>
  <block type="my_speed_block"></block>
  <block type="my_value_block"></block>
</category>
```

### 5. Rebuild

```bash
npm run build:boards:arduino
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| `appendDummyInput()` | No input slot |
| `appendValueInput("NAME")` | Has input slot (can connect other blocks) |
| `setPreviousStatement(true)` | Connectable at top |
| `setNextStatement(true)` | Connectable at bottom |
| `setOutput(true, "Type")` | Has output (expression block) |
| `getFieldValue('NAME')` | Get parameter value |
| `generator.definitions_['key']` | Add import/setup (deduplicated by key) |
| `return 'code\n'` | Statement block returns string |
| `return ['code', ORDER]` | Expression block returns array |
