#ifndef SMARTCAR_P4_PLATE_RECEIVER_HPP_
#define SMARTCAR_P4_PLATE_RECEIVER_HPP_

#include <Arduino.h>

// Shared P4 receiver for plate and road-sign applications.
//
// This module never creates a FreeRTOS task. Call Update() repeatedly from
// loop() or from a task created by the application/Mixly program.
namespace P4PlateReceiver {

// Returned by GetLabelId() when the latest packet is "No Sign" or when no
// valid inference result has been received yet.
constexpr uint8_t kNoLabel = 0xFF;
constexpr uint8_t kMismatchLabel = 0xFE;

enum class ConfirmationMode : uint8_t { Consecutive, Majority };

// Application-owned label text must remain valid for the whole program.
// Consecutive uses requiredMatches; Majority collects sampleCount valid
// results and requires requiredMatches votes for one label (a strict majority).
struct Config {
  uint16_t labelCount = 0;
  const char *(*labelText)(uint8_t) = nullptr;
  ConfirmationMode mode = ConfirmationMode::Consecutive;
  uint8_t requiredMatches = 3;
  uint8_t sampleCount = 5;
  uint8_t minConfidence = 120;
  const char *resultName = "label";  // Only affects diagnostic wording.
};

// Call once before StartCommunication() and before starting an Update task.
// Returns false for invalid settings or while communication is enabled.
// No model export or movement code is compiled into this library.
bool Configure(const Config &config);

// Checks the P4 presence-detect ADC input. The pin, averaging, and threshold
// are private implementation details. Returns exactly 0 or 1.
uint8_t CheckAdc();

// Opens the UART (on the first call) and tells the P4 to start/resume sending
// inference packets. Safe to call more than once.
void StartCommunication();

// Tells the P4 to stop sending inference packets. The UART remains open so a
// later StartCommunication() call can resume communication.
void StopCommunication();
uint8_t IsCommunicationEnabled();

// Parses all UART bytes currently available and caches the newest valid
// packet. Call this often. Returns 1 if at least one valid packet was received
// during this call, otherwise 0.
//
// Uses the configured labels, confidence threshold, and confirmation mode.
// Consecutive: rejected/corrupt packets, duplicate/skipped frame IDs, and
// stale results break the streak. Confidence is the minimum in the streak.
// Majority: rejected/corrupt packets and duplicate frames do not vote; gaps
// are allowed. No majority starts a new window. Confidence is the winning
// label's average. NO SIGN and MISMATCH can never be confirmed in either mode.
// After confirmation, sends ACK_STOP and waits for the P4 to stop transmitting.
// CompleteAction() resumes transmission after the application finishes motion.
// Call Update() from exactly one context; decision/end/complete requests can
// be posted by the application's other core. This library creates no tasks.
uint8_t Update();

// Returns the latest valid MATCH label ID, or kNoLabel for rejected/no result.
uint8_t GetLabelId();

// Resolves the configured label text. Reserved/out-of-range IDs are "unknown".
const char *GetLabelText(uint8_t labelId);

// Returns the latest real-sign confidence (0-255), or 0 for "No Sign" or
// before the first real-sign result.
uint8_t GetConfidence();

// Returns 1 when the latest packet contains a real, in-distribution result;
// returns 0 for "No Sign" or before the first packet.
uint8_t HasValidResult();

// A confirmed label has passed the configured filter. Values stay latched until
// CompleteAction() or ClearConfirmedSign() is called.
uint8_t HasConfirmedSign();
uint8_t GetConfirmedLabelId();
const char *GetConfirmedLabelText();  // "none" until a label is confirmed.
uint8_t GetConfirmedConfidence();
void ClearConfirmedSign();

// Starts a fresh confirmation session. Update() drains stale UART data
// and enables counting/printing. Wait for
// IsDecisionCollectionReady() before checking HasConfirmedSign().
void BeginDecisionCollection();
uint8_t IsDecisionCollectionReady();

// Ends the confirmation session. Update() continues reading UART so the
// receive buffer stays empty, but results are not counted or
// printed until BeginDecisionCollection() is called again.
void EndDecisionCollection();

// Returns 1 while the ACK_STOP / action / RESUME cycle is active.
uint8_t IsControlCycleActive();

// Returns 1 after a label is confirmed and the P4's UART has gone idle.
uint8_t IsReadyForAction();

// Call after the motor sequence completes. Queues completion for Update(),
// which clears the confirmed label, sends RESUME, and optionally re-arms
// confirmation. Pass false to keep counting disabled until
// BeginDecisionCollection(), e.g. during a restart wait
// and startup movement. There is no automatic timer.
void CompleteAction(bool collectNextDecision = true);

// Returns 1 while valid UART packets are arriving. It becomes 0 when no valid
// packet has arrived within the library's private timeout.
uint8_t CheckAlive();

// Optional diagnostics useful when testing a new model or UART connection.
// Prints one read-only snapshot: receive/control state, link age, packet
// counters, last verdict, and confirmation count. Does not send any command.
void PrintStatus();
uint16_t GetFrameId();
uint8_t GetFlags();
uint32_t GetBytesReceived();
uint32_t GetPacketsOk();
uint32_t GetPacketsBad();

}  // namespace P4PlateReceiver

#endif  // SMARTCAR_P4_PLATE_RECEIVER_HPP_
