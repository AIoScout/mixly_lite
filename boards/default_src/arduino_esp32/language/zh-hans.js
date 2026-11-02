import * as Mixly from 'mixly';
import TEMPLATE from '../template/board-config-message.html';

const ZhHans = {};
const { XML } = Mixly;

ZhHans.ESP32_CONFIG_TEMPLATE = TEMPLATE;

ZhHans.ESP32_CONFIG_INTRODUCE = '详细介绍请参考';

ZhHans.ESP32_CONFIG_MESSAGE_PSRAM = XML.render(ZhHans.ESP32_CONFIG_TEMPLATE, {
    title: 'PSRAM',
    message: 'PSRAM是存在于某些板、模块或SoC上的内部或外部扩展RAM。',
    moreInfo: ZhHans.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#psram',
    name: 'PSRAM'
});

ZhHans.ESP32_CONFIG_MESSAGE_PARTITION_SCHEME = XML.render(ZhHans.ESP32_CONFIG_TEMPLATE, {
    title: '分区方案',
    message: '此选项用于根据闪存大小和所需资源（如存储区域和OTA（空中更新））选择分区方案。请注意根据闪存大小选择正确的分区，如果你选择了错误的分区，系统将崩溃。',
    moreInfo: ZhHans.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#partition-scheme',
    name: 'Partition Scheme'
});

ZhHans.ESP32_CONFIG_MESSAGE_CPU_FREQUENCY = XML.render(ZhHans.ESP32_CONFIG_TEMPLATE, {
    title: 'CPU时钟频率',
    message: '在此选项上，你可以选择CPU时钟频率。此选项至关重要，必须根据板上的晶振和无线模块使用情况（Wi-Fi和蓝牙）进行选择。在某些应用中，建议降低CPU时钟频率以降低功耗。如果你不知道为什么要更改此频率，请保留默认选项。',
    moreInfo: ZhHans.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#cpu-frequency',
    name: 'CPU Frequency'
});

ZhHans.ESP32_CONFIG_MESSAGE_FLASH_MODE = XML.render(ZhHans.ESP32_CONFIG_TEMPLATE, {
    title: '烧录方式',
    message: '此选项用于选择与闪存的SPI通信模式。根据应用程序的不同，可以更改此模式以提高闪存通信速度。',
    moreInfo: ZhHans.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#flash-mode',
    name: 'Flash Mode'
});

ZhHans.ESP32_CONFIG_MESSAGE_FLASH_FREQUENCY = XML.render(ZhHans.ESP32_CONFIG_TEMPLATE, {
    title: '闪存频率',
    message: '使用此功能可选择闪存频率。频率取决于内存型号，如果你不知道内存是否支持80Mhz，你可以尝试使用80Mhz选项上传草图，并通过串行监视器查看日志输出。',
    moreInfo: ZhHans.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#partition-scheme',
    name: 'Flash Frequency'
});

ZhHans.ESP32_CONFIG_MESSAGE_FLASH_SIZE = XML.render(ZhHans.ESP32_CONFIG_TEMPLATE, {
    title: '闪存大小',
    message: '此选项用于选择闪存大小。应该根据你板上使用的闪存型号来确定闪存大小，如果你选择了错误的大小，则在选择分区方案时可能会出现问题。',
    moreInfo: ZhHans.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#flash-size',
    name: 'Flash Size'
});

ZhHans.ESP32_CONFIG_MESSAGE_UPLOAD_SPEED = XML.render(ZhHans.ESP32_CONFIG_TEMPLATE, {
    title: '上传速度',
    message: '要选择上传速度，请更改“上载速度”，此值将用于向设备烧录代码。如果在用较高的上传速度时出现问题，请尝试减小此值，这可能是由于外部串行到USB芯片的限制。',
    moreInfo: ZhHans.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#upload-speed',
    name: 'Upload Speed'
});

ZhHans.ESP32_CONFIG_MESSAGE_ARDUINO_RUNS_ON = XML.render(ZhHans.ESP32_CONFIG_TEMPLATE, {
    title: 'Arduino循环核心',
    message: '此选项用于选择运行Arduino核心任务的内核。只有当目标SoC有2个核心时才有效。当你有一些繁重的任务在运行时，你可能想在与Arduino任务不同的核心上运行此任务。出于这个原因，你可以使用此配置来选择正确的核心。',
    moreInfo: ZhHans.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#arduino-runs-on',
    name: 'Arduino Runs On'
});

ZhHans.ESP32_CONFIG_MESSAGE_EVENTS_RUN_ON = XML.render(ZhHans.ESP32_CONFIG_TEMPLATE, {
    title: 'Arduino事件核心',
    message: '此选项用于选择运行Arduino事件的核心，这仅在目标SoC具有2个核心的情况下有效。',
    moreInfo: ZhHans.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#events-run-on',
    name: 'Events Run On'
});

ZhHans.ESP32_CONFIG_MESSAGE_USB_CDC_ON_BOOT = XML.render(ZhHans.ESP32_CONFIG_TEMPLATE, {
    title: 'USB CDC On Boot',
    message: 'USB通信设备类，或USB CDC，是一个用于基本通信的类，被用作常规串行控制器。该类用于在没有任何其他外部设备连接到SoC的情况下烧写设备。该选项可用于在启动时启用或禁用该功能。如果此选项为E启用，则一旦设备通过USB连接，一个新的串行端口将出现在串行端口列表中，使用这个新的串行端口来烧写设备。这个选项也可以用于使用CDC而不是UART0通过串行监视器进行调试。',
    moreInfo: ZhHans.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#usb-cdc-on-boot',
    name: 'USB CDC On Boot'
});

ZhHans.ESP32_CONFIG_MESSAGE_USB_FIRMWARE_MSC_ON_BOOT = XML.render(ZhHans.ESP32_CONFIG_TEMPLATE, {
    title: 'USB Firmware MSC On Boot',
    message: 'USB大容量存储类或USB MSC是用于存储设备（如USB闪存驱动器）的类，此选项可用于在启动时启用或禁用此功能。如果此选项为启用，则一旦设备通过USB连接，系统中将显示一个新的存储设备作为存储驱动器。使用这个新的存储驱动器来写入和读取文件，或者拖拽新的二进制固件来烧写设备。',
    moreInfo: ZhHans.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#usb-firmware-msc-on-boot',
    name: 'USB Firmware MSC On Boot'
});

ZhHans.ESP32_CONFIG_MESSAGE_USB_DFU_ON_BOOT = XML.render(ZhHans.ESP32_CONFIG_TEMPLATE, {
    title: 'USB DFU On Boot',
    message: 'USB设备固件升级是一个用于通过USB烧写设备的类，此选项可用于在启动时启用或禁用此功能。如果此选项为启用，则一旦设备通过USB连接，该设备将显示为支持USB DFU的设备。',
    moreInfo: ZhHans.ESP32_CONFIG_INTRODUCE,
    href: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html#usb-dfu-on-boot',
    name: 'USB DFU On Boot'
});

ZhHans.ESP32_CONFIG_MESSAGE_UPLOAD_MODE = XML.render(ZhHans.ESP32_CONFIG_TEMPLATE, {
    title: '上传方式',
    moreInfo: ZhHans.ESP32_CONFIG_INTRODUCE,
    href: '#',
    name: '无'
});

ZhHans.ESP32_CONFIG_MESSAGE_USB_MODE = XML.render(ZhHans.ESP32_CONFIG_TEMPLATE, {
    title: 'USB模式',
    moreInfo: ZhHans.ESP32_CONFIG_INTRODUCE,
    href: '#',
    name: '无'
});

ZhHans.BOARD_FS = '板卡文件管理';

// ============================================
// SmartCar Block Translations
// ============================================

// Motors
ZhHans.SMARTCAR_MOVE_FORWARD = '前进';
ZhHans.SMARTCAR_MOVE_BACKWARD = '后退';
ZhHans.SMARTCAR_ROTATE_LEFT = '左转';
ZhHans.SMARTCAR_ROTATE_RIGHT = '右转';
ZhHans.SMARTCAR_STOP = '停止';
ZhHans.SMARTCAR_SET_SPEED = '设置电机速度';
ZhHans.SMARTCAR_SPEED = '速度 (0-4095)';

// IR Sensors
ZhHans.SMARTCAR_IR_DATA_UPDATA = '红外数据更新';
ZhHans.SMARTCAR_READ_IR_LEFT = '左侧红外传感器';
ZhHans.SMARTCAR_READ_IR_MIDDLE = '中间红外传感器';
ZhHans.SMARTCAR_READ_IR_RIGHT = '右侧红外传感器';
ZhHans.SMARTCAR_GET_TRACK_STATE = '循迹状态';

// Ultrasonic
ZhHans.SMARTCAR_GET_DISTANCE = '距离 (厘米)';

// RFID
ZhHans.SMARTCAR_READ_RFID = 'RFID 标签 UID';
ZhHans.SMARTCAR_HAS_NEW_TAG = '有新 RFID 标签';
ZhHans.SMARTCAR_RFID_UPDATE = 'RFID 更新';

// Buzzer
ZhHans.SMARTCAR_PLAY_TONE = '播放音调';
ZhHans.SMARTCAR_FREQUENCY = '频率 (Hz)';
ZhHans.SMARTCAR_DURATION = '持续时间 (毫秒)';
ZhHans.SMARTCAR_BUZZER_STOP = '停止蜂鸣器';

// Firebase
ZhHans.SMARTCAR_IS_EXAM_ACTIVATED = '考试已激活';
ZhHans.SMARTCAR_GET_TRAFFIC_LIGHT = '红绿灯';
ZhHans.SMARTCAR_LIGHT_ID = '编号';
ZhHans.SMARTCAR_STATE = '状态';
ZhHans.SMARTCAR_GET_TIME_REMAIN = '剩余时间';
ZhHans.SMARTCAR_TIME_REMAIN = '剩余时间';
ZhHans.SMARTCAR_TARGET = 'RPM';

// PID Control
ZhHans.SMARTCAR_SET_PID = '设置 PID 参数';
ZhHans.SMARTCAR_GET_LEFT_RPM = '左轮转速 (RPM)';
ZhHans.SMARTCAR_GET_RIGHT_RPM = '右轮转速 (RPM)';
ZhHans.SMARTCAR_SET_TARGET_RPM = '设置目标转速';
ZhHans.SMARTCAR_PID_UPDATE_LOOP = 'PID 更新循环';

// Tooltips
ZhHans.SMARTCAR_MOVE_FORWARD_TOOLTIP = '让小车前进';
ZhHans.SMARTCAR_MOVE_BACKWARD_TOOLTIP = '让小车后退';
ZhHans.SMARTCAR_ROTATE_LEFT_TOOLTIP = '使小车左转（逆时针）';
ZhHans.SMARTCAR_ROTATE_RIGHT_TOOLTIP = '使小车右转（顺时针）';
ZhHans.SMARTCAR_STOP_TOOLTIP = '停止所有电机';
ZhHans.SMARTCAR_SET_SPEED_TOOLTIP = '设置两个电机的速度（0-4095 PWM 占空比）';
ZhHans.SMARTCAR_IR_DATA_UPDATA_TOOLTIP = '读取红外传感器并更新缓存的红外数据';
ZhHans.SMARTCAR_READ_IR_LEFT_TOOLTIP = '读取左侧红外传感器（true = 检测到黑线）';
ZhHans.SMARTCAR_READ_IR_MIDDLE_TOOLTIP = '读取中间红外传感器（true = 检测到黑线）';
ZhHans.SMARTCAR_READ_IR_RIGHT_TOOLTIP = '读取右侧红外传感器（true = 检测到黑线）';
ZhHans.SMARTCAR_GET_TRACK_STATE_TOOLTIP = '获取当前循迹状态（0-7）';
ZhHans.SMARTCAR_GET_DISTANCE_TOOLTIP = '获取超声波传感器测得的距离（厘米）';
ZhHans.SMARTCAR_READ_RFID_TOOLTIP = '读取当前 RFID 标签 UID';
ZhHans.SMARTCAR_HAS_NEW_TAG_TOOLTIP = '检查是否有新的 RFID 标签';
ZhHans.SMARTCAR_RFID_UPDATE_TOOLTIP = '读取 RFID 卡序列数据，成功读取到 UID 时返回 true';
ZhHans.SMARTCAR_PLAY_TONE_TOOLTIP = '在蜂鸣器上播放音调';
ZhHans.SMARTCAR_BUZZER_STOP_TOOLTIP = '停止蜂鸣器';
ZhHans.SMARTCAR_IS_EXAM_ACTIVATED_TOOLTIP = '检查考试是否已激活';
ZhHans.SMARTCAR_GET_TRAFFIC_LIGHT_TOOLTIP = '获取红绿灯状态（RED、YELLOW、GREEN）';
ZhHans.SMARTCAR_GET_TIME_REMAIN_TOOLTIP = '获取红绿灯的剩余时间';
ZhHans.SMARTCAR_SET_PID_TOOLTIP = '为两个轮子设置 PID 控制器参数';
ZhHans.SMARTCAR_GET_LEFT_RPM_TOOLTIP = '获取左轮当前转速 (RPM)';
ZhHans.SMARTCAR_GET_RIGHT_RPM_TOOLTIP = '获取右轮当前转速 (RPM)';
ZhHans.SMARTCAR_SET_TARGET_RPM_TOOLTIP = '为两个轮子设置目标转速';
ZhHans.SMARTCAR_PID_UPDATE_LOOP_TOOLTIP = '更新编码器转速并将 PID 输出应用到两个轮子的速度';
// AI Vision
ZhHans.AIVISION_INIT_EYE = '初始化 AI 眼睛（摄像头+AI）';
ZhHans.AIVISION_INIT_EYE_TOOLTIP = '在 AI 眼睛板上初始化摄像头、AI模型和通信';
ZhHans.AIVISION_INIT_BODY = '初始化 AI 身体（接收结果）';
ZhHans.AIVISION_INIT_BODY_TOOLTIP = '初始化为 AI 身体板，接收来自 AI 眼睛的识别结果';
ZhHans.AIVISION_UPLOAD_MODEL = '加载 AI 模型';
ZhHans.AIVISION_UPLOAD_MODEL_TOOLTIP = '上传 .tflite 模型和标签文件';
ZhHans.AIVISION_USE_PSRAM = '使用 PSRAM';
ZhHans.AIVISION_USE_INTERNAL = '使用内部 RAM';
ZhHans.AIVISION_PREDICT = 'AI 预测';
ZhHans.AIVISION_PREDICT_TOOLTIP = '获取 AI 预测结果';
ZhHans.AIVISION_PREDICT_LABEL = '标签';
ZhHans.AIVISION_PREDICT_INDEX = '类别编号';
ZhHans.AIVISION_PREDICT_CONFIDENCE = '置信度';
ZhHans.AIVISION_CLASS_COUNT = '类别数量';
ZhHans.AIVISION_CLASS_COUNT_TOOLTIP = '获取 AI 模型中的类别总数';
ZhHans.AIVISION_HAS_NEW_RESULT = '有新 AI 结果';
ZhHans.AIVISION_HAS_NEW_RESULT_TOOLTIP = '当有新的 AI 结果时为真';
ZhHans.AIVISION_SEND_RESULT = '发送 AI 结果给搭档';
ZhHans.AIVISION_SEND_RESULT_TOOLTIP = '将上次 AI 预测结果发送给搭档板（默认自动发送）';
ZhHans.AIVISION_SET_UART_PINS = '设置通信引脚';
ZhHans.AIVISION_SET_UART_PINS_TOOLTIP = '设置 UART 通信引脚（默认：TX=43, RX=44）';

export default ZhHans;
// SmartCar plugin (compile/upload/save/open buttons & status pill)
ZhHans.PLUGIN_COMPILE = '编译';
ZhHans.PLUGIN_UPLOAD = '上传';
ZhHans.PLUGIN_SAVE = '保存';
ZhHans.PLUGIN_OPEN = '打开';
ZhHans.PLUGIN_STATUS_CONNECTING = '连接中';
ZhHans.PLUGIN_STATUS_CONNECTED = '已连接';
ZhHans.PLUGIN_STATUS_DISCONNECTED = '未连接';
ZhHans.AIVISION_NO_MODELS = '还没有模型 — 先去训练一个';
ZhHans.AIVISION_REFRESH_MODELS = '⟳ 刷新';

// SmartCar P4 链路 + 巡线复合积木
ZhHans.SMARTCAR_P4_START_LINK = 'P4 链路启动（路牌识别）';
ZhHans.SMARTCAR_P4_START_LINK_TOOLTIP = '打开与 AI Eye（P4）板的 UART 链路并在后台接收路牌识别结果。放在 setup 里。配合串口积木（115200）可查看识别日志。';
ZhHans.SMARTCAR_P4_WAIT_SIGN = 'P4 等待确认路牌';
ZhHans.SMARTCAR_P4_WAIT_SIGN_TOOLTIP = '开启新一轮投票并（阻塞）等待 AI Eye 板确认一张路牌。请先停车。之后用确认类别/置信度积木取值，最后结束会话。';
ZhHans.SMARTCAR_P4_CONFIRMED_LABEL = 'P4 确认类别号';
ZhHans.SMARTCAR_P4_CONFIRMED_LABEL_TOOLTIP = '已确认路牌的类别号。类别号与 AI Training 应用里的类别顺序一致（0、1、2 …）。';
ZhHans.SMARTCAR_P4_SIGN_IS = 'P4 确认路牌是类别';
ZhHans.SMARTCAR_P4_SIGN_IS_TAIL = '';
ZhHans.SMARTCAR_P4_SIGN_IS_TOOLTIP = '当确认路牌的类别号等于给定数字时为真。类别号与 AI Training 应用里的类别顺序一致。';
ZhHans.SMARTCAR_P4_CONFIRMED_CONF = 'P4 确认置信度';
ZhHans.SMARTCAR_P4_CONFIRMED_CONF_TOOLTIP = '已确认路牌的置信度，0-255。';
ZhHans.SMARTCAR_P4_END_DECISION = 'P4 结束决策会话';
ZhHans.SMARTCAR_P4_END_DECISION_TOOLTIP = '结束投票会话，让 AI Eye 板恢复发送结果。完成路牌动作后调用。';
ZhHans.SMARTCAR_IR_ALL_BLACK = '线传感器全黑';
ZhHans.SMARTCAR_IR_ALL_BLACK_TOOLTIP = '三个循迹传感器都看到黑色（停车标线）时为真。需要先更新 IR 传感器。';
ZhHans.SMARTCAR_FOLLOW_UNTIL = '循线直到';
ZhHans.SMARTCAR_STOP_ALL_BLACK = '全黑标线';
ZhHans.SMARTCAR_STOP_ALL_BLACK_OR_RFID = '全黑标线或 RFID 卡';
ZhHans.SMARTCAR_FOLLOW_UNTIL_TOOLTIP = '用 PID 速度控制循线，直到停车条件触发后停车，继续执行后续积木（例如蜂鸣、再 P4 等待确认路牌）。';

ZhHans.SMARTCAR_WAIT_CENTERED = '等待回到线中央';
ZhHans.SMARTCAR_WAIT_CENTERED_TOOLTIP = '等待小车重新回到线的中央（转弯后）。若停车条件触发也会停车。需与循线积木一起使用。';

ZhHans.PLUGIN_ROAD_SIGN_DEMO = '路牌识别例程';
ZhHans.PLUGIN_ROAD_SIGN_DEMO_TIP = '加载路牌识别 workshop 积木程序（会替换当前积木）';
ZhHans.PLUGIN_ROAD_SIGN_DEMO_CONFIRM = '用路牌识别例程替换当前的积木程序？';

ZhHans.PLUGIN_OPEN_FILE = '从本地文件打开…';

ZhHans.SMARTCAR_STOP_ULTRASONIC = '超声波障碍';
ZhHans.SMARTCAR_STOP_DISTANCE = 'cm';
ZhHans.SMARTCAR_OBSTACLE_WAIT = '等待障碍移开';
ZhHans.SMARTCAR_OBSTACLE_RESUME = '恢复距离 cm';
ZhHans.SMARTCAR_OBSTACLE_TIMEOUT = '超时 s';
ZhHans.SMARTCAR_OBSTACLE_WAIT_TOOLTIP = '（停车状态）等待距离大于恢复值，或超时结束。约每 100 ms 测一次距。';
ZhHans.SMARTCAR_RFID_REPORT = '上报新 RFID 卡';
ZhHans.SMARTCAR_RFID_REPORT_TOOLTIP = '检查一次 RFID 读卡器，出现新卡（与上次不同）时把卡号打印到串口。请在循环里反复调用。';
ZhHans.SMARTCAR_LEFT_MOTOR = '左电机';
ZhHans.SMARTCAR_CLOCKWISE = '顺时针';
ZhHans.SMARTCAR_ANTICLOCKWISE = '逆时针';
ZhHans.SMARTCAR_DUTY = '功率 %';
ZhHans.SMARTCAR_FOR_MS = '持续 ms';
ZhHans.SMARTCAR_LEFT_MOTOR_TOOLTIP = '只驱动左电机按给定方向以给定 PWM 功率百分比运行一段时间后刹车。右电机保持停止。';
ZhHans.SMARTCAR_LEFT_SEQUENCE = '左电机启动序列';
ZhHans.SMARTCAR_CW_MS = '顺时针 ms';
ZhHans.SMARTCAR_PAUSE_MS = '停顿 ms';
ZhHans.SMARTCAR_ACW_MS = '逆时针 ms';
ZhHans.SMARTCAR_LEFT_SEQUENCE_TOOLTIP = '车闸启动流程：顺时针、刹车停顿、逆时针、刹车——全部由左电机以同一功率完成。';
ZhHans.SMARTCAR_P4_PLATE_START = 'P4 链路启动（车牌识别）';
ZhHans.SMARTCAR_P4_PLATE_START_TOOLTIP = '打开与运行多车牌固件的 AI Eye（P4）板的 UART 链路。放在 setup 里；配合串口积木（115200）可查看识别日志。';
ZhHans.SMARTCAR_P4_PLATE_UPDATE = 'P4 车牌收包';
ZhHans.SMARTCAR_P4_PLATE_UPDATE_TOOLTIP = '处理一次收到的车牌数据包。每个循环都要调用。';
ZhHans.SMARTCAR_P4_PLATE_READY = 'P4 车牌已确认？';
ZhHans.SMARTCAR_P4_PLATE_READY_TOOLTIP = '同一车牌连续三帧确认（置信度 120+）时为真。执行动作后调用"动作完成"积木。';
ZhHans.SMARTCAR_P4_PLATE_DONE = 'P4 车牌动作完成';
ZhHans.SMARTCAR_P4_PLATE_DONE_TOOLTIP = '告诉 AI Eye 板车牌动作已结束，恢复发送结果。动作完成后调用。';
ZhHans.SMARTCAR_P4_PLATE_INDEX = 'P4 最新车牌号';
ZhHans.SMARTCAR_P4_PLATE_INDEX_TOOLTIP = '最新有效数据包的车牌号（0-253），看不到车牌时为 255。';
ZhHans.PLUGIN_TURNSTILE_HARDCODE = '车闸启动演示';
ZhHans.PLUGIN_TURNSTILE_CAR = '车闸小车演示';
ZhHans.PLUGIN_TURNSTILE_PLATE = '车闸车牌演示';

ZhHans.PLUGIN_MONITOR = '监视器';
ZhHans.PLUGIN_MONITOR_OPEN = '打开所选端口的串口监视器';
ZhHans.PLUGIN_MONITOR_CLOSE = '关闭串口监视器';
ZhHans.PLUGIN_SELECT_PORT_FIRST = '请先选择一个串口';

ZhHans.PLUGIN_AI_BODY_STARTER = 'AI Body 入门程序';



ZhHans.AIVISION_SIGN_FW = 'AI Eye 固件（已导出模型）';
ZhHans.AIVISION_SIGN_FW_TOOLTIP = '编译/上传时构建并烧录承载 AI Training 导出模型的 AI Eye（P4）固件，而不是积木代码。请先选 AI Eye 板的串口。';
ZhHans.PLUGIN_AI_EYE_FIRMWARE = 'AI Eye 固件 (P4)';
