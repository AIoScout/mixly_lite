#include "SmartCar/P4PlateReceiver.hpp"
#include <atomic>

namespace {

// Shared packet/verdict contract from the training receiver. All model labels,
// confirmation settings, and motor actions belong to the application.
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

constexpr uint32_t kStopResponseTimeoutMs = 300;
constexpr uint32_t kStopIdleConfirmMs = 150;
constexpr uint32_t kResumeResponseTimeoutMs = 500;
constexpr uint8_t kControlMaxAttempts = 3;

constexpr uint8_t kFlagsMaskSignReady = 0x0F;
constexpr uint8_t kFlagsMaskOodStatus = 0xF0;
constexpr uint8_t kFlagsSignReady = 0x02;
constexpr uint8_t kFlagsVerdictMatch = 0x00;
constexpr uint8_t kFlagsVerdictMismatch = 0xE0;
constexpr uint8_t kFlagsVerdictNoSign = 0xF0;

constexpr size_t kInferencePacketSize = 9;
constexpr size_t kControlPacketSize = 5;

HardwareSerial &kP4Uart = Serial0;
P4PlateReceiver::Config s_config;
bool s_configured = false;
// Requests from the application are consumed only by the Update() owner.
// 0 = none, 1 = complete without collecting, 2 = complete and collect again.
std::atomic<uint8_t> s_completeActionRequested{0};

struct Packet {
  uint8_t msg_type;
  uint16_t frame_id;
  uint8_t label_id;
  uint8_t confidence;
  uint8_t flags;
};

// Like the reference receiver, skip USB diagnostics without an attached host.
// operator bool supports both HWCDC and TinyUSB CDC builds.
template <typename... Args>
void DebugPrintf(const char *format, Args... args) {
  if (static_cast<bool>(Serial)) {
    Serial.printf(format, args...);
  }
}

void DebugPrintln(const char *message) {
  if (static_cast<bool>(Serial)) {
    Serial.println(message);
  }
}

uint8_t s_packetBuffer[kInferencePacketSize] = {};
size_t s_packetIndex = 0;
uint8_t s_parserState = 0;
std::atomic<bool> s_uartStarted = false;
std::atomic<bool> s_communicationEnabled = false;
bool s_adcConfigured = false;

// label, confidence, and flags fit into one naturally aligned 32-bit value.
// Publishing them together avoids mixed fields when Update() runs in a task
// created by the user's Mixly program and getters run on another core.
//   bits  7..0  label ID
//   bits 15..8  confidence
//   bits 23..16 flags
std::atomic<uint32_t> s_result =
    static_cast<uint32_t>(P4PlateReceiver::kNoLabel);
std::atomic<uint16_t> s_frameId = 0;
std::atomic<uint32_t> s_lastPacketMs = 0;
std::atomic<bool> s_hasReceivedPacket = false;
std::atomic<uint32_t> s_confirmedResult =
    static_cast<uint32_t>(P4PlateReceiver::kNoLabel);
std::atomic<bool> s_hasConfirmedSign = false;
std::atomic<bool> s_beginDecisionCollectionRequested = false;
std::atomic<bool> s_endDecisionCollectionRequested = false;
std::atomic<bool> s_decisionCollectionReady = false;
std::atomic<bool> s_decisionCollectionEnabled = false;
std::atomic<uint32_t> s_bytesReceived = 0;
std::atomic<uint32_t> s_packetsOk = 0;
std::atomic<uint32_t> s_packetsBad = 0;

uint8_t s_lastPlateId = P4PlateReceiver::kNoLabel;
std::atomic<uint8_t> s_consecutivePlateFrames = 0;
uint8_t s_streakMinConfidence = 0;
uint16_t s_lastPlateFrameId = 0;
uint32_t s_lastPlateMs = 0;
constexpr uint16_t kMaxLabelCount = P4PlateReceiver::kMismatchLabel;
uint8_t s_voteCounts[kMaxLabelCount] = {};
uint16_t s_voteConfidenceSums[kMaxLabelCount] = {};
std::atomic<uint8_t> s_collectedVoteResults = 0;
uint32_t s_voteAttempt = 1;
uint16_t s_lastVoteFrameId = 0;
bool s_hasVoteFrame = false;
uint16_t s_voteFrameIds[255] = {};

enum class ControlCycleState : uint8_t {
  kReceiving,
  kWaitingForStop,
  kTaskWindow,
  kWaitingForResume,
};

std::atomic<ControlCycleState> s_controlCycleState{ControlCycleState::kReceiving};
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
         (flags & kFlagsMaskOodStatus) == kFlagsVerdictMatch;
}

bool IsMismatch(uint8_t flags) {
  return (flags & kFlagsMaskOodStatus) == kFlagsVerdictMismatch;
}

bool IsNoSign(uint8_t flags) {
  return (flags & kFlagsMaskOodStatus) == kFlagsVerdictNoSign;
}

bool LabelIsValid(uint8_t labelId) {
  return s_configured && labelId < P4PlateReceiver::kMismatchLabel &&
         labelId < s_config.labelCount;
}

const char *LabelText(uint8_t labelId) {
  return LabelIsValid(labelId) ? s_config.labelText(labelId) : "unknown";
}

bool DeadlineReached(uint32_t now, uint32_t deadline) {
  return static_cast<int32_t>(now - deadline) >= 0;
}

void ResetSignConfirmation(const char *reason = nullptr) {
  if (reason && s_decisionCollectionEnabled && s_consecutivePlateFrames > 0) {
    DebugPrintf("%s, count 0/%u\n", reason,
                static_cast<unsigned int>(s_config.requiredMatches));
  }
  s_lastPlateId = P4PlateReceiver::kNoLabel;
  s_consecutivePlateFrames = 0;
  s_streakMinConfidence = 0;
  s_lastPlateFrameId = 0;
  s_lastPlateMs = 0;
  for (uint16_t label = 0; label < kMaxLabelCount; ++label) {
    s_voteCounts[label] = 0;
    s_voteConfidenceSums[label] = 0;
  }
  s_collectedVoteResults = 0;
  s_voteAttempt = 1;
  s_hasVoteFrame = false;
}

bool IsMatchedLabel(uint8_t labelId, uint8_t flags) {
  return IsRealSign(flags) && LabelIsValid(labelId);
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
    if (s_config.mode == P4PlateReceiver::ConfirmationMode::Consecutive) {
      ResetSignConfirmation("invalid packet");
    }
    return false;
  }

  Packet packet;
  packet.msg_type = s_packetBuffer[2];
  packet.frame_id = static_cast<uint16_t>(s_packetBuffer[3]) |
                    (static_cast<uint16_t>(s_packetBuffer[4]) << 8);
  packet.label_id = s_packetBuffer[5];
  packet.confidence = s_packetBuffer[6];
  packet.flags = s_packetBuffer[7];

  const uint32_t packedResult = static_cast<uint32_t>(packet.label_id) |
                                (static_cast<uint32_t>(packet.confidence) << 8) |
                                (static_cast<uint32_t>(packet.flags) << 16);

  s_frameId = packet.frame_id;
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

void ConfirmLabel(uint8_t labelId, uint8_t confidence, uint32_t now) {
  s_confirmedResult = static_cast<uint32_t>(labelId) |
                      (static_cast<uint32_t>(confidence) << 8) |
                      (static_cast<uint32_t>(kFlagsSignReady) << 16);
  s_decisionCollectionEnabled = false;
  DebugPrintf("%s #%u(%s) confirmed, pausing P4\n", s_config.resultName,
              static_cast<unsigned int>(labelId), LabelText(labelId));
  BeginStopCycle(now);
  s_hasConfirmedSign = true;
}

void ProcessVote(uint8_t labelId, uint8_t confidence, uint32_t now) {
  const uint16_t frameId = s_frameId;
  if (s_hasVoteFrame && frameId == s_lastVoteFrameId) {
    return;  // Retransmission is not a second vote from the camera.
  }
  for (uint16_t i = 0; i < s_collectedVoteResults; ++i) {
    if (s_voteFrameIds[i] == frameId) return;
  }
  s_voteFrameIds[s_collectedVoteResults] = frameId;
  s_hasVoteFrame = true;
  s_lastVoteFrameId = frameId;
  DebugPrintf("Result %u/%u: %s, confidence %u/255\n",
              static_cast<unsigned int>(s_collectedVoteResults + 1),
              static_cast<unsigned int>(s_config.sampleCount), LabelText(labelId),
              static_cast<unsigned int>(confidence));
  ++s_voteCounts[labelId];
  s_voteConfidenceSums[labelId] += confidence;
  ++s_collectedVoteResults;
  if (s_collectedVoteResults < s_config.sampleCount) {
    return;
  }

  uint8_t winner = 0;
  for (uint16_t label = 1; label < s_config.labelCount; ++label) {
    if (s_voteCounts[label] > s_voteCounts[winner]) {
      winner = static_cast<uint8_t>(label);
    }
  }
  if (s_voteCounts[winner] >= s_config.requiredMatches) {
    const uint8_t average = static_cast<uint8_t>(
        s_voteConfidenceSums[winner] / s_voteCounts[winner]);
    DebugPrintf("Confirmed result: %s (%u/%u votes), confidence %u/255\n",
                LabelText(winner), static_cast<unsigned int>(s_voteCounts[winner]),
                static_cast<unsigned int>(s_config.sampleCount),
                static_cast<unsigned int>(average));
    ConfirmLabel(winner, average, now);
    return;
  }

  // Keep the last frame ID across windows so a duplicate cannot become a vote.
  for (uint16_t label = 0; label < s_config.labelCount; ++label) {
    s_voteCounts[label] = 0;
    s_voteConfidenceSums[label] = 0;
  }
  s_collectedVoteResults = 0;
  ++s_voteAttempt;
  DebugPrintf("Attempt %lu\n", static_cast<unsigned long>(s_voteAttempt));
}

void ProcessSignConfirmation(uint32_t now) {
  const uint32_t result = s_result;
  const uint8_t labelId = static_cast<uint8_t>(result & 0xFF);
  const uint8_t confidence = static_cast<uint8_t>((result >> 8) & 0xFF);
  const uint8_t flags = static_cast<uint8_t>((result >> 16) & 0xFF);

  if (!IsMatchedLabel(labelId, flags) || confidence < s_config.minConfidence) {
    // Majority windows contain valid results only. Rejected results do not
    // consume a vote or erase the other votes, preserving road_sign behavior.
    if (s_config.mode == P4PlateReceiver::ConfirmationMode::Majority) {
      return;
    }
    const char *reason = IsNoSign(flags) ? "no sign" :
                         IsMismatch(flags) ? "mismatch" :
                         !IsRealSign(flags) ? "invalid verdict" :
                         !LabelIsValid(labelId) ? "unknown label" :
                         "low confidence";
    ResetSignConfirmation(reason);
    return;
  }

  if (s_config.mode == P4PlateReceiver::ConfirmationMode::Majority) {
    ProcessVote(labelId, confidence, now);
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

  DebugPrintf("detected %s #%u(%s) (MATCH), count %u/%u\n", s_config.resultName,
                static_cast<unsigned int>(labelId),
                LabelText(labelId),
                static_cast<unsigned int>(s_consecutivePlateFrames),
                static_cast<unsigned int>(s_config.requiredMatches));

  if (s_consecutivePlateFrames >= s_config.requiredMatches) {
    ConfirmLabel(labelId, s_streakMinConfidence, now);
  }
}

void BeginTaskWindow() {
  s_controlCycleState = ControlCycleState::kTaskWindow;
  // The application calls CompleteAction() when motion has actually finished.
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
  s_completeActionRequested = 0;
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
        DebugPrintln("P4 stop retries exhausted; action cancelled. Reset to retry.");
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

bool Configure(const Config &config) {
  if (s_communicationEnabled || config.labelCount == 0 ||
      config.labelCount > kMaxLabelCount || config.labelText == nullptr ||
      config.resultName == nullptr || config.resultName[0] == '\0' ||
      config.requiredMatches == 0) {
    return false;
  }
  if (config.mode != ConfirmationMode::Consecutive &&
      config.mode != ConfirmationMode::Majority) {
    return false;
  }
  if (config.mode == ConfirmationMode::Majority &&
      (config.sampleCount == 0 || config.requiredMatches > config.sampleCount ||
       config.requiredMatches <= config.sampleCount / 2)) {
    return false;
  }
  for (uint16_t label = 0; label < config.labelCount; ++label) {
    const char *text = config.labelText(static_cast<uint8_t>(label));
    if (text == nullptr || text[0] == '\0') {
      return false;
    }
  }
  s_config = config;
  s_configured = true;
  return true;
}

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
  if (!s_configured) {
    DebugPrintln("Configure the P4 receiver before starting communication.");
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
  s_completeActionRequested = 0;
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

uint8_t IsCommunicationEnabled() {
  return s_communicationEnabled ? 1 : 0;
}

uint8_t Update() {
  if (!s_uartStarted || !s_communicationEnabled) {
    return 0;
  }

  // All parser/filter/control mutations run on this owner, including completion
  // posted from a motor task on the other core.
  // Keep the request visible until confirmation is cleared, so the other core
  // cannot observe the old action as ready again during completion handling.
  const uint8_t completion = s_completeActionRequested.load();
  if (completion != 0 && s_hasConfirmedSign &&
      s_controlCycleState == ControlCycleState::kTaskWindow) {
    ClearConfirmedSign();
    ResetSignConfirmation();
    s_decisionCollectionEnabled = completion == 2;
    s_decisionCollectionReady = completion == 2;
    BeginResume(millis());
    if (completion == 2) {
      if (s_config.mode == ConfirmationMode::Majority) {
        DebugPrintln("Attempt 1");
      } else {
        DebugPrintf("waiting for %s\n", s_config.resultName);
      }
    }
  }
  if (completion != 0) s_completeActionRequested = 0;

  if (s_endDecisionCollectionRequested.exchange(false)) {
    s_decisionCollectionEnabled = false;
    s_decisionCollectionReady = false;
    ResetSignConfirmation();
    s_hasConfirmedSign = false;
    s_confirmedResult = static_cast<uint32_t>(kNoLabel);
  }

  if (s_beginDecisionCollectionRequested.exchange(false)) {
    s_decisionCollectionEnabled = false;
    s_decisionCollectionReady = false;
    DrainInput();
    ResetSignConfirmation();
    s_hasConfirmedSign = false;
    s_confirmedResult = static_cast<uint32_t>(kNoLabel);
    if (s_config.mode == ConfirmationMode::Majority) {
      DebugPrintln("Attempt 1");
    } else {
      DebugPrintf("waiting for %s\n", s_config.resultName);
    }
    s_decisionCollectionEnabled = true;
    s_decisionCollectionReady = true;
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
      !IsMatchedLabel(static_cast<uint8_t>(result & 0xFF), flags)) {
    return kNoLabel;
  }
  return static_cast<uint8_t>(result & 0xFF);
}

const char *GetLabelText(uint8_t labelId) {
  return LabelText(labelId);
}

uint8_t GetConfidence() {
  const uint32_t result = s_result;
  const uint8_t flags = static_cast<uint8_t>((result >> 16) & 0xFF);
  if (!s_hasReceivedPacket ||
      !IsMatchedLabel(static_cast<uint8_t>(result & 0xFF), flags)) {
    return 0;
  }
  return static_cast<uint8_t>((result >> 8) & 0xFF);
}

uint8_t HasValidResult() {
  const uint32_t result = s_result;
  const uint8_t flags = static_cast<uint8_t>((result >> 16) & 0xFF);
  return s_hasReceivedPacket &&
                 IsMatchedLabel(static_cast<uint8_t>(result & 0xFF), flags)
             ? 1
             : 0;
}

uint8_t HasConfirmedSign() {
  return s_hasConfirmedSign && s_completeActionRequested == 0 ? 1 : 0;
}

uint8_t GetConfirmedLabelId() {
  if (!HasConfirmedSign()) {
    return kNoLabel;
  }
  return static_cast<uint8_t>(s_confirmedResult & 0xFF);
}

const char *GetConfirmedLabelText() {
  return HasConfirmedSign() ? LabelText(GetConfirmedLabelId()) : "none";
}

uint8_t GetConfirmedConfidence() {
  if (!HasConfirmedSign()) {
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
  return s_decisionCollectionReady && s_completeActionRequested == 0 ? 1 : 0;
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
  return HasConfirmedSign() &&
                 s_controlCycleState == ControlCycleState::kTaskWindow
             ? 1
             : 0;
}

void CompleteAction(bool collectNextDecision) {
  if (!IsReadyForAction()) {
    return;
  }
  s_completeActionRequested = collectNextDecision ? 2 : 1;
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

void PrintStatus() {
  const char *state = "NOT_STARTED";
  if (s_uartStarted && !s_communicationEnabled) {
    state = "DISABLED";
  } else if (s_uartStarted) {
    switch (s_controlCycleState) {
      case ControlCycleState::kReceiving: state = "RECEIVING"; break;
      case ControlCycleState::kWaitingForStop: state = "WAITING_FOR_P4_STOP"; break;
      case ControlCycleState::kTaskWindow: state = "ACTION"; break;
      case ControlCycleState::kWaitingForResume: state = "WAITING_FOR_P4_RESUME"; break;
    }
  }

  const char *link = "NO_PACKETS";
  if (!s_communicationEnabled) {
    link = "DISABLED";
  } else if (s_controlCycleState == ControlCycleState::kTaskWindow) {
    link = "PAUSED";  // No packets are expected during the motor action.
  } else if (s_hasReceivedPacket) {
    link = CheckAlive() ? "LIVE" : "TIMEOUT";
  }
  const bool majority = s_config.mode == ConfirmationMode::Majority;
  DebugPrintf("receiver=%s collecting=%s | uart=%s | bytes=%lu ok=%lu bad=%lu | count=%u/%u\n",
              state, s_decisionCollectionEnabled ? "yes" : "no", link,
              static_cast<unsigned long>(s_bytesReceived),
              static_cast<unsigned long>(s_packetsOk),
              static_cast<unsigned long>(s_packetsBad),
              static_cast<unsigned int>(majority ? s_collectedVoteResults : s_consecutivePlateFrames),
              static_cast<unsigned int>(majority ? s_config.sampleCount : s_config.requiredMatches));
  if (!s_hasReceivedPacket) {
    DebugPrintln("last packet=none");
    return;
  }

  const uint32_t result = s_result;
  const uint8_t label = static_cast<uint8_t>(result & 0xFF);
  const uint8_t confidence = static_cast<uint8_t>((result >> 8) & 0xFF);
  const uint8_t flags = static_cast<uint8_t>((result >> 16) & 0xFF);
  const char *verdict = IsNoSign(flags) ? "NO_SIGN" :
                        IsMismatch(flags) ? "MISMATCH" :
                        IsMatchedLabel(label, flags) ? "MATCH" :
                        IsRealSign(flags) ? "UNKNOWN_LABEL" : "INVALID";
  DebugPrintf("last frame=%u verdict=%s flags=0x%02X label=%u(%s) conf=%u age=%lu ms\n",
              static_cast<unsigned int>(s_frameId), verdict,
              static_cast<unsigned int>(flags), static_cast<unsigned int>(label),
              IsMatchedLabel(label, flags) ? LabelText(label) : "-",
              static_cast<unsigned int>(confidence),
              static_cast<unsigned long>(millis() - s_lastPacketMs));
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
