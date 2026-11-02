#include "SmartCar/P4PlateReceiver.hpp"

namespace {

// Local turnstile receiver: byte 5 is a whitelist plate index, not a road sign.
constexpr int kUartBaud = 921600;
constexpr int kUartRxPin = 44;
constexpr int kUartTxPin = 43;

constexpr int kP4DetectAdcPin = 8;
constexpr int kP4DetectThreshold = 2000;
constexpr int kP4DetectSamples = 16;

constexpr uint32_t kAliveTimeoutMs = 2000;

constexpr uint8_t kSync0 = 0xAA;
constexpr uint8_t kSync1 = 0x55;
constexpr uint8_t kMsgTypeInference = 0x01;
constexpr uint8_t kMsgTypeControl = 0x02;
constexpr uint8_t kControlAckStop = 0x01;
constexpr uint8_t kControlResumeJunction = 0x02;

constexpr uint8_t kPlateConfirmFrames = 3;
constexpr uint8_t kSignConfirmConfidence = 120;
constexpr uint32_t kStopResponseTimeoutMs = 300;
constexpr uint32_t kStopIdleConfirmMs = 150;
constexpr uint32_t kResumeResponseTimeoutMs = 500;
constexpr uint8_t kControlMaxAttempts = 3;

constexpr uint8_t kFlagsMaskSignReady = 0x0F;
constexpr uint8_t kFlagsMaskOodStatus = 0xF0;
constexpr uint8_t kFlagsSignReady = 0x02;

constexpr size_t kInferencePacketSize = 9;
constexpr size_t kControlPacketSize = 5;

HardwareSerial &kP4Uart = Serial0;

uint8_t s_packetBuffer[kInferencePacketSize] = {};
size_t s_packetIndex = 0;
uint8_t s_parserState = 0;
volatile bool s_uartStarted = false;
volatile bool s_communicationEnabled = false;
bool s_adcConfigured = false;

// label, confidence, and flags fit into one naturally aligned 32-bit value.
// Publishing them together avoids mixed fields when Update() runs in a task
// created by the user's Mixly program and getters run on another core.
//   bits  7..0  label ID
//   bits 15..8  confidence
//   bits 23..16 flags
volatile uint32_t s_result =
    static_cast<uint32_t>(P4PlateReceiver::kNoLabel);
volatile uint16_t s_frameId = 0;
volatile uint32_t s_lastPacketMs = 0;
volatile bool s_hasReceivedPacket = false;
volatile uint32_t s_confirmedResult =
    static_cast<uint32_t>(P4PlateReceiver::kNoLabel);
volatile bool s_hasConfirmedSign = false;
volatile bool s_beginDecisionCollectionRequested = false;
volatile bool s_endDecisionCollectionRequested = false;
volatile bool s_decisionCollectionReady = false;
volatile bool s_decisionCollectionEnabled = false;
volatile uint32_t s_bytesReceived = 0;
volatile uint32_t s_packetsOk = 0;
volatile uint32_t s_packetsBad = 0;

uint8_t s_lastPlateId = P4PlateReceiver::kNoLabel;
uint8_t s_consecutivePlateFrames = 0;
uint8_t s_streakMinConfidence = 0;
uint16_t s_lastPlateFrameId = 0;
uint32_t s_lastPlateMs = 0;

enum class ControlCycleState : uint8_t {
  kReceiving,
  kWaitingForStop,
  kTaskWindow,
  kWaitingForResume,
};

ControlCycleState s_controlCycleState = ControlCycleState::kReceiving;
uint8_t s_controlAttempt = 0;
uint32_t s_controlDeadlineMs = 0;
uint32_t s_lastUartByteMs = 0;

uint8_t CalculateChecksum(const uint8_t *data, size_t length) {
  uint8_t checksum = 0;
  for (size_t i = 0; i < length; ++i) {
    checksum ^= data[i];
  }
  return checksum;
}

bool IsRealSign(uint8_t flags) {
  return (flags & kFlagsMaskSignReady) == kFlagsSignReady &&
         (flags & kFlagsMaskOodStatus) == 0x00;
}

bool DeadlineReached(uint32_t now, uint32_t deadline) {
  return static_cast<int32_t>(now - deadline) >= 0;
}

void ResetSignConfirmation(const char *reason = nullptr) {
  if (reason && s_decisionCollectionEnabled && s_consecutivePlateFrames > 0) {
    Serial.printf("%s, count 0/3\n", reason);
  }
  s_lastPlateId = P4PlateReceiver::kNoLabel;
  s_consecutivePlateFrames = 0;
  s_streakMinConfidence = 0;
  s_lastPlateFrameId = 0;
  s_lastPlateMs = 0;
}

bool IsMatchedPlate(uint8_t labelId, uint8_t flags) {
  // The P4 owns the whitelist. 0xFE and 0xFF are reserved verdict sentinels.
  return IsRealSign(flags) && labelId < P4PlateReceiver::kMismatchLabel;
}

void ResetParser() {
  s_packetIndex = 0;
  s_parserState = 0;
}

void SendControlPacket(uint8_t command) {
  if (!s_uartStarted) {
    return;
  }

  uint8_t buffer[kControlPacketSize] = {
      kSync0, kSync1, kMsgTypeControl, command, 0};
  buffer[kControlPacketSize - 1] =
      CalculateChecksum(buffer, kControlPacketSize - 1);
  kP4Uart.write(buffer, sizeof(buffer));
  kP4Uart.flush();
}

void DrainInput() {
  while (kP4Uart.available() > 0) {
    (void)kP4Uart.read();
  }
  ResetParser();
}

bool ParseByte(uint8_t value) {
  if (s_parserState == 0) {
    if (value == kSync0) {
      s_packetBuffer[0] = value;
      s_packetIndex = 1;
      s_parserState = 1;
    }
    return false;
  }

  if (s_parserState == 1) {
    if (value == kSync1) {
      s_packetBuffer[1] = value;
      s_packetIndex = 2;
      s_parserState = 2;
    } else if (value == kSync0) {
      s_packetBuffer[0] = value;
      s_packetIndex = 1;
    } else {
      ResetParser();
    }
    return false;
  }

  s_packetBuffer[s_packetIndex++] = value;
  if (s_packetIndex < kInferencePacketSize) {
    return false;
  }

  ResetParser();
  if (s_packetBuffer[2] != kMsgTypeInference ||
      CalculateChecksum(s_packetBuffer, kInferencePacketSize - 1) !=
          s_packetBuffer[kInferencePacketSize - 1]) {
    s_packetsBad = s_packetsBad + 1;
    ResetSignConfirmation("invalid packet");
    return false;
  }

  const uint16_t frameId =
      static_cast<uint16_t>(s_packetBuffer[3]) |
      (static_cast<uint16_t>(s_packetBuffer[4]) << 8);
  const uint8_t labelId = s_packetBuffer[5];
  const uint8_t confidence = s_packetBuffer[6];
  const uint8_t flags = s_packetBuffer[7];

  const uint32_t packedResult = static_cast<uint32_t>(labelId) |
                                (static_cast<uint32_t>(confidence) << 8) |
                                (static_cast<uint32_t>(flags) << 16);

  s_frameId = frameId;
  s_result = packedResult;
  s_lastPacketMs = millis();
  s_hasReceivedPacket = true;
  s_packetsOk = s_packetsOk + 1;
  return true;
}

void BeginStopCycle(uint32_t now) {
  SendControlPacket(kControlAckStop);
  s_controlCycleState = ControlCycleState::kWaitingForStop;
  s_controlAttempt = 1;
  s_controlDeadlineMs = now + kStopResponseTimeoutMs;
  s_lastUartByteMs = now;
}

void ProcessSignConfirmation(uint32_t now) {
  const uint32_t result = s_result;
  const uint8_t labelId = static_cast<uint8_t>(result & 0xFF);
  const uint8_t confidence = static_cast<uint8_t>((result >> 8) & 0xFF);
  const uint8_t flags = static_cast<uint8_t>((result >> 16) & 0xFF);

  if (!IsMatchedPlate(labelId, flags) || confidence < kSignConfirmConfidence) {
    const char *reason = flags == 0xF2 ? "no sign" :
                         flags == 0xE2 ? "mismatch" :
                         confidence < kSignConfirmConfidence ? "low confidence" :
                         "invalid match";
    ResetSignConfirmation(reason);
    return;
  }

  const uint16_t frameId = s_frameId;
  if (s_consecutivePlateFrames > 0 && frameId == s_lastPlateFrameId) {
    // Receiving a duplicate packet does not provide another camera frame.
    ResetSignConfirmation("duplicate frame");
    return;
  }

  const bool continuesStreak =
      s_consecutivePlateFrames > 0 && labelId == s_lastPlateId &&
      static_cast<uint16_t>(frameId - s_lastPlateFrameId) == 1 &&
      static_cast<uint32_t>(now - s_lastPlateMs) <= kAliveTimeoutMs;
  if (continuesStreak) {
    ++s_consecutivePlateFrames;
    if (confidence < s_streakMinConfidence) {
      s_streakMinConfidence = confidence;
    }
  } else {
    s_lastPlateId = labelId;
    s_consecutivePlateFrames = 1;
    s_streakMinConfidence = confidence;
  }
  s_lastPlateFrameId = frameId;
  s_lastPlateMs = now;

  Serial.printf("detected plate #%u (MATCH), count %u/%u\n",
                static_cast<unsigned int>(labelId),
                static_cast<unsigned int>(s_consecutivePlateFrames),
                static_cast<unsigned int>(kPlateConfirmFrames));

  if (s_consecutivePlateFrames >= kPlateConfirmFrames) {
    s_confirmedResult = static_cast<uint32_t>(labelId) |
                        (static_cast<uint32_t>(s_streakMinConfidence) << 8) |
                        (static_cast<uint32_t>(flags) << 16);
    s_hasConfirmedSign = true;
    s_decisionCollectionEnabled = false;
    Serial.printf("plate #%u confirmed, pausing P4\n",
                  static_cast<unsigned int>(labelId));
    BeginStopCycle(now);
  }
}

void BeginTaskWindow() {
  s_controlCycleState = ControlCycleState::kTaskWindow;
  // The turnstile calls CompleteAction() when motion has actually finished.
  s_controlDeadlineMs = 0;
}

void BeginResume(uint32_t now) {
  DrainInput();
  SendControlPacket(kControlResumeJunction);
  s_controlCycleState = ControlCycleState::kWaitingForResume;
  s_controlAttempt = 1;
  s_controlDeadlineMs = now + kResumeResponseTimeoutMs;
}

void FinishControlCycle() {
  s_controlCycleState = ControlCycleState::kReceiving;
  s_controlAttempt = 0;
  s_controlDeadlineMs = 0;
  ResetSignConfirmation();
}

void DisableCommunication() {
  s_communicationEnabled = false;
  s_hasReceivedPacket = false;
  s_lastPacketMs = 0;
  s_beginDecisionCollectionRequested = false;
  s_endDecisionCollectionRequested = false;
  s_decisionCollectionReady = false;
  s_decisionCollectionEnabled = false;
  s_hasConfirmedSign = false;
  s_confirmedResult = static_cast<uint32_t>(P4PlateReceiver::kNoLabel);
  FinishControlCycle();
}

void AdvanceControlCycle(uint32_t now) {
  if (s_controlCycleState == ControlCycleState::kWaitingForStop) {
    if (static_cast<uint32_t>(now - s_lastUartByteMs) >=
        kStopIdleConfirmMs) {
      BeginTaskWindow();
    } else if (DeadlineReached(now, s_controlDeadlineMs)) {
      if (s_controlAttempt < kControlMaxAttempts) {
        ++s_controlAttempt;
        SendControlPacket(kControlAckStop);
        s_controlDeadlineMs = now + kStopResponseTimeoutMs;
      } else {
        Serial.println("P4 stop retries exhausted; turnstile remains stopped. Reset to retry.");
        DisableCommunication();
      }
    }
    return;
  }

  if (s_controlCycleState == ControlCycleState::kWaitingForResume &&
      DeadlineReached(now, s_controlDeadlineMs)) {
    if (s_controlAttempt < kControlMaxAttempts) {
      ++s_controlAttempt;
      SendControlPacket(kControlResumeJunction);
      s_controlDeadlineMs = now + kResumeResponseTimeoutMs;
    } else {
      // Match the reference receiver: return to receive mode after exhausting
      // retries, so a late P4 response can still be processed.
      FinishControlCycle();
    }
  }
}

}  // namespace

namespace P4PlateReceiver {

uint8_t CheckAdc() {
  if (!s_adcConfigured) {
    pinMode(kP4DetectAdcPin, INPUT);
    s_adcConfigured = true;
  }

  uint32_t sum = 0;
  for (int i = 0; i < kP4DetectSamples; ++i) {
    sum += static_cast<uint32_t>(analogRead(kP4DetectAdcPin));
    delayMicroseconds(100);
  }

  const uint32_t average = sum / kP4DetectSamples;
  return average >= static_cast<uint32_t>(kP4DetectThreshold) ? 1 : 0;
}

void StartCommunication() {
  if (s_communicationEnabled) {
    return;
  }

  if (!s_uartStarted) {
    // Prevent a floating RX input from producing garbage before the P4 is
    // powered and driving the line.
    pinMode(kUartRxPin, INPUT_PULLDOWN);
    kP4Uart.begin(kUartBaud, SERIAL_8N1, kUartRxPin, kUartTxPin);
    s_uartStarted = true;
  }

  // Discard packets left in the hardware FIFO after an earlier stop. They do
  // not prove that the P4 has responded to this new resume command.
  DrainInput();
  s_communicationEnabled = true;
  s_hasReceivedPacket = false;
  s_lastPacketMs = 0;
  s_controlCycleState = ControlCycleState::kReceiving;
  ResetSignConfirmation();
  s_beginDecisionCollectionRequested = false;
  s_endDecisionCollectionRequested = false;
  s_decisionCollectionReady = false;
  s_decisionCollectionEnabled = false;
  s_hasConfirmedSign = false;
  s_confirmedResult = static_cast<uint32_t>(kNoLabel);
  SendControlPacket(kControlResumeJunction);
}

void StopCommunication() {
  if (!s_communicationEnabled) {
    return;
  }

  SendControlPacket(kControlAckStop);
  DisableCommunication();
}

uint8_t Update() {
  if (!s_uartStarted || !s_communicationEnabled) {
    return 0;
  }

  // Update() owns the UART parser and consecutive-frame state.
  if (s_endDecisionCollectionRequested) {
    s_decisionCollectionEnabled = false;
    s_decisionCollectionReady = false;
    ResetSignConfirmation();
    s_hasConfirmedSign = false;
    s_confirmedResult = static_cast<uint32_t>(kNoLabel);
    s_endDecisionCollectionRequested = false;
  }

  if (s_beginDecisionCollectionRequested) {
    s_decisionCollectionEnabled = false;
    s_decisionCollectionReady = false;
    DrainInput();
    ResetSignConfirmation();
    s_hasConfirmedSign = false;
    s_confirmedResult = static_cast<uint32_t>(kNoLabel);
    Serial.println("waiting for plate");
    s_decisionCollectionEnabled = true;
    s_decisionCollectionReady = true;
    s_beginDecisionCollectionRequested = false;
  }

  bool receivedPacket = false;
  while (kP4Uart.available() > 0) {
    const uint8_t value = static_cast<uint8_t>(kP4Uart.read());
    s_bytesReceived = s_bytesReceived + 1;
    s_lastUartByteMs = millis();
    if (ParseByte(value)) {
      receivedPacket = true;
      const uint32_t now = millis();
      if (s_controlCycleState == ControlCycleState::kWaitingForResume) {
        FinishControlCycle();
        if (s_decisionCollectionEnabled) {
          ProcessSignConfirmation(now);
        }
      } else if (s_controlCycleState == ControlCycleState::kReceiving &&
                 s_decisionCollectionEnabled) {
        ProcessSignConfirmation(now);
      }
    }
  }
  AdvanceControlCycle(millis());
  return receivedPacket ? 1 : 0;
}

uint8_t GetLabelId() {
  const uint32_t result = s_result;
  const uint8_t flags = static_cast<uint8_t>((result >> 16) & 0xFF);
  if (!s_hasReceivedPacket ||
      !IsMatchedPlate(static_cast<uint8_t>(result & 0xFF), flags)) {
    return kNoLabel;
  }
  return static_cast<uint8_t>(result & 0xFF);
}

uint8_t GetConfidence() {
  const uint32_t result = s_result;
  const uint8_t flags = static_cast<uint8_t>((result >> 16) & 0xFF);
  if (!s_hasReceivedPacket ||
      !IsMatchedPlate(static_cast<uint8_t>(result & 0xFF), flags)) {
    return 0;
  }
  return static_cast<uint8_t>((result >> 8) & 0xFF);
}

uint8_t HasValidResult() {
  const uint32_t result = s_result;
  const uint8_t flags = static_cast<uint8_t>((result >> 16) & 0xFF);
  return s_hasReceivedPacket &&
                 IsMatchedPlate(static_cast<uint8_t>(result & 0xFF), flags)
             ? 1
             : 0;
}

uint8_t HasConfirmedSign() {
  return s_hasConfirmedSign ? 1 : 0;
}

uint8_t GetConfirmedLabelId() {
  if (!s_hasConfirmedSign) {
    return kNoLabel;
  }
  return static_cast<uint8_t>(s_confirmedResult & 0xFF);
}

uint8_t GetConfirmedConfidence() {
  if (!s_hasConfirmedSign) {
    return 0;
  }
  return static_cast<uint8_t>((s_confirmedResult >> 8) & 0xFF);
}

void ClearConfirmedSign() {
  s_hasConfirmedSign = false;
  s_confirmedResult = static_cast<uint32_t>(kNoLabel);
}

void BeginDecisionCollection() {
  s_decisionCollectionReady = false;
  s_beginDecisionCollectionRequested = true;
}

uint8_t IsDecisionCollectionReady() {
  return s_decisionCollectionReady ? 1 : 0;
}

void EndDecisionCollection() {
  // Close the gate immediately. Update() performs the remaining reset because
  // it owns the UART parser and confirmation state.
  s_decisionCollectionEnabled = false;
  s_decisionCollectionReady = false;
  s_endDecisionCollectionRequested = true;
}

uint8_t IsControlCycleActive() {
  return s_controlCycleState == ControlCycleState::kReceiving ? 0 : 1;
}

uint8_t IsReadyForAction() {
  return s_hasConfirmedSign &&
                 s_controlCycleState == ControlCycleState::kTaskWindow
             ? 1
             : 0;
}

void CompleteAction() {
  if (!IsReadyForAction()) {
    return;
  }
  ClearConfirmedSign();
  ResetSignConfirmation();
  s_decisionCollectionEnabled = true;
  BeginResume(millis());
  Serial.println("waiting for plate");
}

uint8_t CheckAlive() {
  if (!s_uartStarted || !s_communicationEnabled || !s_hasReceivedPacket) {
    return 0;
  }
  return static_cast<uint32_t>(millis() - s_lastPacketMs) <=
                 kAliveTimeoutMs
             ? 1
             : 0;
}

uint16_t GetFrameId() {
  return s_frameId;
}

uint8_t GetFlags() {
  const uint32_t result = s_result;
  return static_cast<uint8_t>((result >> 16) & 0xFF);
}

uint32_t GetBytesReceived() {
  return s_bytesReceived;
}

uint32_t GetPacketsOk() {
  return s_packetsOk;
}

uint32_t GetPacketsBad() {
  return s_packetsBad;
}

}  // namespace P4PlateReceiver
