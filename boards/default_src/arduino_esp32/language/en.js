import * as Mixly from 'mixly';
import TEMPLATE from '../template/board-config-message.html';

const En = {};
const { XML } = Mixly;

En.ESP32_CONFIG_TEMPLATE = TEMPLATE;

En.ESP32_CONFIG_INTRODUCE = 'For more information, please visit';

En.ESP32_CONFIG_MESSAGE_PSRAM = XML.render(En.ESP32_CONFIG_TEMPLATE, {
    title: 'PSRAM',
    message: 'The PSRAM is an internal or external extended RAM present on some boards, modules or SoC.',
    moreInfo: En.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#psram',
    name: 'PSRAM'
});

En.ESP32_CONFIG_MESSAGE_PARTITION_SCHEME = XML.render(En.ESP32_CONFIG_TEMPLATE, {
    title: 'Partition Scheme',
    message: 'This option is used to select the partition model according to the flash size and the resources needed, like storage area and OTA (Over The Air updates). Be careful selecting the right partition according to the flash size. If you select the wrong partition, the system will crash.',
    moreInfo: En.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#partition-scheme',
    name: 'Partition Scheme'
});

En.ESP32_CONFIG_MESSAGE_CPU_FREQUENCY = XML.render(En.ESP32_CONFIG_TEMPLATE, {
    title: 'CPU Frequency',
    message: 'On this option, you can select the CPU clock frequency. This option is critical and must be selected according to the high-frequency crystal present on the board and the radio usage (Wi-Fi and Bluetooth). In some applications, reducing the CPU clock frequency is recommended in order to reduce power consumption. If you don’t know why you should change this frequency, leave the default option.',
    moreInfo: En.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#cpu-frequency',
    name: 'CPU Frequency'
});

En.ESP32_CONFIG_MESSAGE_FLASH_MODE = XML.render(En.ESP32_CONFIG_TEMPLATE, {
    title: 'Flash Mode',
    message: 'This option is used to select the SPI communication mode with the flash memory. Depending on the application, this mode can be changed in order to increase the flash communication speed.',
    moreInfo: En.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#flash-mode',
    name: 'Flash Mode'
});

En.ESP32_CONFIG_MESSAGE_FLASH_FREQUENCY = XML.render(En.ESP32_CONFIG_TEMPLATE, {
    title: 'Flash Frequency',
    message: 'Use this function to select the flash memory frequency. The frequency will be dependent on the memory model.',
    moreInfo: En.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#partition-scheme',
    name: 'Flash Frequency'
});

En.ESP32_CONFIG_MESSAGE_FLASH_SIZE = XML.render(En.ESP32_CONFIG_TEMPLATE, {
    title: 'Flash Size',
    message: 'This option is used to select the flash size. The flash size should be selected according to the flash model used on your board. If you choose the wrong size, you may have issues when selecting the partition scheme.',
    moreInfo: En.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#flash-size',
    name: 'Flash Size'
});

En.ESP32_CONFIG_MESSAGE_UPLOAD_SPEED = XML.render(En.ESP32_CONFIG_TEMPLATE, {
    title: 'Upload Speed',
    message: 'To select the flashing speed, change the Upload Speed. This value will be used for flashing the code to the device. If you have issues while flashing the device at high speed, try to decrease this value. This could be due to the external serial-to-USB chip limitations.',
    moreInfo: En.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#upload-speed',
    name: 'Upload Speed'
});

En.ESP32_CONFIG_MESSAGE_ARDUINO_RUNS_ON = XML.render(En.ESP32_CONFIG_TEMPLATE, {
    title: 'Arduino Runs On',
    message: 'This function is used to select the core that runs the Arduino core. This is only valid if the target SoC has 2 cores. When you have some heavy task running, you might want to run this task on a different core than the Arduino tasks. For this reason, you have this configuration to select the right core.',
    moreInfo: En.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#arduino-runs-on',
    name: 'Arduino Runs On'
});

En.ESP32_CONFIG_MESSAGE_EVENTS_RUN_ON = XML.render(En.ESP32_CONFIG_TEMPLATE, {
    title: 'Events Run On',
    message: 'This function is also used to select the core that runs the Arduino events. This is only valid if the target SoC has 2 cores.',
    moreInfo: En.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#events-run-on',
    name: 'Events Run On'
});

En.ESP32_CONFIG_MESSAGE_USB_CDC_ON_BOOT = XML.render(En.ESP32_CONFIG_TEMPLATE, {
    title: 'USB CDC On Boot',
    message: 'The USB Communications Device Class, or USB CDC, is a class used for basic communication to be used as a regular serial controller (like RS-232). This class is used for flashing the device without any other external device attached to the SoC. This option can be used to Enable or Disable this function at the boot. If this option is Enabled, once the device is connected via USB, one new serial port will appear in the list of the serial ports. Use this new serial port for flashing the device.',
    moreInfo: En.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#usb-cdc-on-boot',
    name: 'USB CDC On Boot'
});

En.ESP32_CONFIG_MESSAGE_USB_FIRMWARE_MSC_ON_BOOT = XML.render(En.ESP32_CONFIG_TEMPLATE, {
    title: 'USB Firmware MSC On Boot',
    message: 'The USB Mass Storage Class, or USB MSC, is a class used for storage devices, like a USB flash drive. This option can be used to Enable or Disable this function at the boot. If this option is Enabled, once the device is connected via USB, one new storage device will appear in the system as a storage drive. Use this new storage drive to write and read files or to drop a new firmware binary to flash the device.',
    moreInfo: En.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#usb-firmware-msc-on-boot',
    name: 'USB Firmware MSC On Boot'
});

En.ESP32_CONFIG_MESSAGE_USB_DFU_ON_BOOT = XML.render(En.ESP32_CONFIG_TEMPLATE, {
    title: 'USB DFU On Boot',
    message: 'The USB Device Firmware Upgrade is a class used for flashing the device through USB. This option can be used to Enable or Disable this function at the boot. If this option is Enabled, once the device is connected via USB, the device will appear as a USB DFU capable device.',
    moreInfo: En.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#usb-dfu-on-boot',
    name: 'USB DFU On Boot'
});

En.ESP32_CONFIG_MESSAGE_UPLOAD_MODE = XML.render(En.ESP32_CONFIG_TEMPLATE, {
    title: 'Upload Mode',
    moreInfo: En.ESP32_CONFIG_INTRODUCE,
    href: '#',
    name: 'None'
});

En.ESP32_CONFIG_MESSAGE_USB_MODE = XML.render(En.ESP32_CONFIG_TEMPLATE, {
    title: 'USB Mode',
    moreInfo: En.ESP32_CONFIG_INTRODUCE,
    href: '#',
    name: 'None'
});

En.BOARD_FS = 'Board FS';

// ============================================
// SmartCar Block Translations
// ============================================

// Motors
En.SMARTCAR_MOVE_FORWARD = 'move forward';
En.SMARTCAR_MOVE_BACKWARD = 'move backward';
En.SMARTCAR_ROTATE_LEFT = 'rotate left';
En.SMARTCAR_ROTATE_RIGHT = 'rotate right';
En.SMARTCAR_STOP = 'stop';
En.SMARTCAR_SET_SPEED = 'set motor speed';
En.SMARTCAR_SPEED = 'speed (0-4095)';

// IR Sensors
En.SMARTCAR_IR_DATA_UPDATA = 'IR data update';
En.SMARTCAR_READ_IR_LEFT = 'IR left sensor';
En.SMARTCAR_READ_IR_MIDDLE = 'IR middle sensor';
En.SMARTCAR_READ_IR_RIGHT = 'IR right sensor';
En.SMARTCAR_GET_TRACK_STATE = 'track state';

// Ultrasonic
En.SMARTCAR_GET_DISTANCE = 'distance (cm)';

// RFID
En.SMARTCAR_READ_RFID = 'RFID tag UID';
En.SMARTCAR_HAS_NEW_TAG = 'has new RFID tag';
En.SMARTCAR_RFID_UPDATE = 'RFID update';

// Buzzer
En.SMARTCAR_PLAY_TONE = 'play tone';
En.SMARTCAR_FREQUENCY = 'frequency (Hz)';
En.SMARTCAR_DURATION = 'duration (ms)';
En.SMARTCAR_BUZZER_STOP = 'stop buzzer';

// Firebase
En.SMARTCAR_IS_EXAM_ACTIVATED = 'exam is activated';
En.SMARTCAR_GET_TRAFFIC_LIGHT = 'traffic light';
En.SMARTCAR_LIGHT_ID = 'ID';
En.SMARTCAR_STATE = 'state';
En.SMARTCAR_GET_TIME_REMAIN = 'time remain';
En.SMARTCAR_TIME_REMAIN = 'time remaining';
En.SMARTCAR_TARGET = 'target';

// PID Control
En.SMARTCAR_SET_PID = 'set PID gains';
En.SMARTCAR_GET_LEFT_RPM = 'left wheel RPM';
En.SMARTCAR_GET_RIGHT_RPM = 'right wheel RPM';
En.SMARTCAR_SET_TARGET_RPM = 'set target RPM';

// Tooltips
En.SMARTCAR_MOVE_FORWARD_TOOLTIP = 'Make the car move forward';
En.SMARTCAR_MOVE_BACKWARD_TOOLTIP = 'Make the car move backward';
En.SMARTCAR_ROTATE_LEFT_TOOLTIP = 'Rotate the car left (counter-clockwise)';
En.SMARTCAR_ROTATE_RIGHT_TOOLTIP = 'Rotate the car right (clockwise)';
En.SMARTCAR_STOP_TOOLTIP = 'Stop all motors';
En.SMARTCAR_SET_SPEED_TOOLTIP = 'Set the speed for both motors (0-4095 PWM duty cycle)';
En.SMARTCAR_IR_DATA_UPDATA_TOOLTIP = 'Read IR sensors and update the cached IR data';
En.SMARTCAR_READ_IR_LEFT_TOOLTIP = 'Read left IR sensor (true = black line detected)';
En.SMARTCAR_READ_IR_MIDDLE_TOOLTIP = 'Read middle IR sensor (true = black line detected)';
En.SMARTCAR_READ_IR_RIGHT_TOOLTIP = 'Read right IR sensor (true = black line detected)';
En.SMARTCAR_GET_TRACK_STATE_TOOLTIP = 'Get current track state (0-7)';
En.SMARTCAR_GET_DISTANCE_TOOLTIP = 'Get distance from ultrasonic sensor in centimeters';
En.SMARTCAR_READ_RFID_TOOLTIP = 'Read the current RFID tag UID';
En.SMARTCAR_HAS_NEW_TAG_TOOLTIP = 'Check if a new RFID tag is present';
En.SMARTCAR_RFID_UPDATE_TOOLTIP = 'Read the RFID card serial data and Returns true if a UID could be read';
En.SMARTCAR_PLAY_TONE_TOOLTIP = 'Play a tone on the buzzer';
En.SMARTCAR_BUZZER_STOP_TOOLTIP = 'Stop the buzzer';
En.SMARTCAR_IS_EXAM_ACTIVATED_TOOLTIP = 'Check if the exam is currently activated';
En.SMARTCAR_GET_TRAFFIC_LIGHT_TOOLTIP = 'Get traffic light state (RED, YELLOW, GREEN)';
En.SMARTCAR_GET_TIME_REMAIN_TOOLTIP = 'Get time remaining for traffic light';
En.SMARTCAR_SET_PID_TOOLTIP = 'Set PID controller gains for both wheels';
En.SMARTCAR_GET_LEFT_RPM_TOOLTIP = 'Get current RPM of left wheel';
En.SMARTCAR_GET_RIGHT_RPM_TOOLTIP = 'Get current RPM of right wheel';
En.SMARTCAR_SET_TARGET_RPM_TOOLTIP = 'Set target RPM for both wheels';
export default En;
