#include "SmartCar/P4UartReceiver.hpp"

namespace {

// Hardware and protocol settings are intentionally private so Mixly users do
// not need to configure thresholds, pins, baud rates, or packet framing.
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

// Keep these defaults synchronized with S3_UART_Receiver.ino.
constexpr uint8_t kVoteResultCount = 5;
constexpr uint8_t kVoteMajorityCount = 3;
constexpr uint8_t kSignConfirmConfidence = 120;
constexpr uint32_t kTaskDurationMs = 3000;
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
    static_cast<uint32_t>(P4UartReceiver::kNoLabel);
volatile uint16_t s_frameId = 0;
volatile uint32_t s_lastPacketMs = 0;
volatile bool s_hasReceivedPacket = false;
volatile uint32_t s_confirmedResult =
    static_cast<uint32_t>(P4UartReceiver::kNoLabel);
volatile bool s_hasConfirmedSign = false;
volatile bool s_beginDecisionCollectionRequested = false;
volatile bool s_endDecisionCollectionRequested = false;
volatile bool s_decisionCollectionReady = false;
volatile bool s_decisionCollectionEnabled = false;
volatile uint32_t s_bytesReceived = 0;
volatile uint32_t s_packetsOk = 0;
volatile uint32_t s_packetsBad = 0;

constexpr uint8_t kLeftLabel = 0;
constexpr uint8_t kStopLabel = 1;
constexpr uint8_t kRightLabel = 2;
constexpr uint8_t kVoteLabelCount = 3;

uint8_t s_voteCounts[kVoteLabelCount] = {};
uint16_t s_voteConfidenceSums[kVoteLabelCount] = {};
uint8_t s_collectedVoteResults = 0;
uint16_t s_voteAttempt = 1;

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

void ResetVoteWindow() {
  for (uint8_t i = 0; i < kVoteLabelCount; ++i) {
    s_voteCounts[i] = 0;
    s_voteConfidenceSums[i] = 0;
  }
  s_collectedVoteResults = 0;
}

void ResetSignConfirmation() {
  ResetVoteWindow();
  s_voteAttempt = 1;
}

bool IsVoteLabel(uint8_t labelId) {
  return labelId == kLeftLabel || labelId == kStopLabel ||
         labelId == kRightLabel;
}

const char *GetVoteLabelName(uint8_t labelId) {
  switch (labelId) {
    case kLeftLabel:
      return "left";
    case kStopLabel:
      return "stop";
    case kRightLabel:
      return "right";
    default:
      return "unknown";
  }
}

const char *GetResultOrdinal(uint8_t resultIndex) {
  static const char *const kOrdinals[kVoteResultCount] = {
      "First", "Second", "Third", "Fourth", "Fifth"};
  return resultIndex < kVoteResultCount ? kOrdinals[resultIndex] : "Next";
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

  // A voting window contains five real LEFT/RIGHT/STOP results whose
  // confidence is at least 120. Other packets do not enter the window.
  if (!IsRealSign(flags) || confidence < kSignConfirmConfidence ||
      !IsVoteLabel(labelId)) {
    return;
  }

  Serial.printf("%s result: %s, confidence %u/255\n",
                GetResultOrdinal(s_collectedVoteResults),
                GetVoteLabelName(labelId),
                static_cast<unsigned int>(confidence));

  ++s_voteCounts[labelId];
  s_voteConfidenceSums[labelId] += confidence;
  ++s_collectedVoteResults;

  if (s_collectedVoteResults < kVoteResultCount) {
    return;
  }

  uint8_t winningLabel = kLeftLabel;
  for (uint8_t label = 1; label < kVoteLabelCount; ++label) {
    if (s_voteCounts[label] > s_voteCounts[winningLabel]) {
      winningLabel = label;
    }
  }

  if (s_voteCounts[winningLabel] >= kVoteMajorityCount) {
    const uint8_t averageConfidence = static_cast<uint8_t>(
        s_voteConfidenceSums[winningLabel] / s_voteCounts[winningLabel]);
    s_confirmedResult = static_cast<uint32_t>(winningLabel) |
                        (static_cast<uint32_t>(averageConfidence) << 8) |
                        (static_cast<uint32_t>(flags) << 16);
    s_hasConfirmedSign = true;
    // One decision is complete. Continue draining UART in Update(), but do not
    // count or print any more inference results until the next explicit stop.
    s_decisionCollectionEnabled = false;
    Serial.printf("Confirmed result: %s (%u/5 votes), confidence %u/255\n",
                  GetVoteLabelName(winningLabel),
                  static_cast<unsigned int>(s_voteCounts[winningLabel]),
                  static_cast<unsigned int>(averageConfidence));
    BeginStopCycle(now);
    return;
  }

  ++s_voteAttempt;
  ResetVoteWindow();
  Serial.printf("Attempt %u\n", static_cast<unsigned int>(s_voteAttempt));
}

void BeginTaskWindow(uint32_t now) {
  s_controlCycleState = ControlCycleState::kTaskWindow;
  s_controlDeadlineMs = now + kTaskDurationMs;
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

void AdvanceControlCycle(uint32_t now) {
  if (s_controlCycleState == ControlCycleState::kWaitingForStop) {
    if (static_cast<uint32_t>(now - s_lastUartByteMs) >=
        kStopIdleConfirmMs) {
      BeginTaskWindow(now);
    } else if (DeadlineReached(now, s_controlDeadlineMs)) {
      if (s_controlAttempt < kControlMaxAttempts) {
        ++s_controlAttempt;
        SendControlPacket(kControlAckStop);
        s_controlDeadlineMs = now + kStopResponseTimeoutMs;
      } else {
        BeginTaskWindow(now);
      }
    }
    return;
  }

  if (s_controlCycleState == ControlCycleState::kTaskWindow &&
      DeadlineReached(now, s_controlDeadlineMs)) {
    BeginResume(now);
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

namespace P4UartReceiver {

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
  SendControlPacket(kControlResumeJunction);
}

void StopCommunication() {
  if (!s_communicationEnabled) {
    return;
  }

  SendControlPacket(kControlAckStop);
  s_communicationEnabled = false;
  s_hasReceivedPacket = false;
  s_lastPacketMs = 0;
  s_beginDecisionCollectionRequested = false;
  s_endDecisionCollectionRequested = false;
  s_decisionCollectionReady = false;
  s_decisionCollectionEnabled = false;
  FinishControlCycle();
}

uint8_t Update() {
  if (!s_uartStarted || !s_communicationEnabled) {
    return 0;
  }

  // Update() is the only function that reads Serial0 or mutates the voting
  // window. The application can request a new decision safely from its other
  // core, then wait until this task has drained all stale UART bytes.
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
    Serial.println("Attempt 1");
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
  if (!s_hasReceivedPacket || !IsRealSign(flags)) {
    return kNoLabel;
  }
  return static_cast<uint8_t>(result & 0xFF);
}

uint8_t GetConfidence() {
  const uint32_t result = s_result;
  const uint8_t flags = static_cast<uint8_t>((result >> 16) & 0xFF);
  if (!s_hasReceivedPacket || !IsRealSign(flags)) {
    return 0;
  }
  return static_cast<uint8_t>((result >> 8) & 0xFF);
}

uint8_t HasValidResult() {
  const uint32_t result = s_result;
  const uint8_t flags = static_cast<uint8_t>((result >> 16) & 0xFF);
  return s_hasReceivedPacket && IsRealSign(flags) ? 1 : 0;
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
  // it owns the UART parser and voting state.
  s_decisionCollectionEnabled = false;
  s_decisionCollectionReady = false;
  s_endDecisionCollectionRequested = true;
}

uint8_t IsControlCycleActive() {
  return s_controlCycleState == ControlCycleState::kReceiving ? 0 : 1;
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

}  // namespace P4UartReceiver
