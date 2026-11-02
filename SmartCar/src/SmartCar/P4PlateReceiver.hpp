#ifndef SMARTCAR_P4_PLATE_RECEIVER_HPP_
#define SMARTCAR_P4_PLATE_RECEIVER_HPP_

#include <Arduino.h>

// Polling multi-plate UART receiver used by this turnstile sketch.
//
// This module never creates a FreeRTOS task. Call Update() repeatedly from
// loop() or from a task created by the application/Mixly program.
namespace P4PlateReceiver {

// Returned by GetLabelId() when the latest packet is "No Sign" or when no
// valid inference result has been received yet.
constexpr uint8_t kNoLabel = 0xFF;
constexpr uint8_t kMismatchLabel = 0xFE;

// Checks the P4 presence-detect ADC input. The pin, averaging, and threshold
// are private implementation details. Returns exactly 0 or 1.
uint8_t CheckAdc();

// Opens the UART (on the first call) and tells the P4 to start/resume sending
// inference packets. Safe to call more than once.
void StartCommunication();

// Tells the P4 to stop sending inference packets. The UART remains open so a
// later StartCommunication() call can resume communication.
void StopCommunication();

// Parses all UART bytes currently available and caches the newest valid
// packet. Call this often. Returns 1 if at least one valid packet was received
// during this call, otherwise 0.
//
// Confirms three consecutive MATCH frames of the same plate at confidence
// >= 120. Rejected/low-confidence/corrupt packets, duplicate or skipped frame
// IDs, and stale results break the streak. A new plate starts at one frame.
// After confirmation, sends ACK_STOP and waits for the P4 to stop transmitting.
// CompleteAction() resumes transmission after the application finishes motion.
uint8_t Update();

// Returns the latest matched plate index (0..253), or kNoLabel for rejected
// packets / no result. These IDs do not index kCategoryLabels.
uint8_t GetLabelId();

// Returns the latest real-sign confidence (0-255), or 0 for "No Sign" or
// before the first real-sign result.
uint8_t GetConfidence();

// Returns 1 when the latest packet contains a real, in-distribution result;
// returns 0 for "No Sign" or before the first packet.
uint8_t HasValidResult();

// A confirmed plate has passed the three-frame filter. Confidence is the
// minimum confidence across those three frames. Values stay latched until
// CompleteAction() or ClearConfirmedSign() is called.
uint8_t HasConfirmedSign();
uint8_t GetConfirmedLabelId();
uint8_t GetConfirmedConfidence();
void ClearConfirmedSign();

// Starts a fresh plate-confirmation session. Update() drains stale UART data
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

// Returns 1 after a plate is confirmed and the P4's UART has gone idle.
uint8_t IsReadyForAction();

// Call after the motor sequence completes. Clears the confirmed plate, sends
// RESUME, and re-arms three-frame confirmation. There is no automatic timer.
void CompleteAction();

// Returns 1 while valid UART packets are arriving. It becomes 0 when no valid
// packet has arrived within the library's private timeout.
uint8_t CheckAlive();

// Optional diagnostics useful when testing a new model or UART connection.
uint16_t GetFrameId();
uint8_t GetFlags();
uint32_t GetBytesReceived();
uint32_t GetPacketsOk();
uint32_t GetPacketsBad();

}  // namespace P4PlateReceiver

#endif  // SMARTCAR_P4_PLATE_RECEIVER_HPP_
