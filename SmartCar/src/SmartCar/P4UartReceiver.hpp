#ifndef SMARTCAR_P4_UART_RECEIVER_HPP_
#define SMARTCAR_P4_UART_RECEIVER_HPP_

#include <Arduino.h>

// Polling UART receiver for inference packets sent by the ESP32-P4.
//
// This module never creates a FreeRTOS task. Call Update() repeatedly from
// loop() or from a task created by the application/Mixly program.
namespace P4UartReceiver {

// Returned by GetLabelId() when the latest packet is "No Sign" or when no
// valid inference result has been received yet.
constexpr uint8_t kNoLabel = 0xFF;

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
// Collects five real LEFT/RIGHT/STOP packets at confidence >= 120. A label is
// confirmed when it appears at least three times in that window. A window with
// no majority is discarded and a fresh five-result attempt begins. Each
// accepted result and attempt is printed to Serial. The receiver then performs
// the ACK_STOP / 3-second task window / RESUME_JUNCTION cycle non-blockingly.
uint8_t Update();

// Returns the latest real-sign label ID, or kNoLabel (255) for "No Sign" or
// before the first real-sign result.
uint8_t GetLabelId();

// Returns the latest real-sign confidence (0-255), or 0 for "No Sign" or
// before the first real-sign result.
uint8_t GetConfidence();

// Returns 1 when the latest packet contains a real, in-distribution result;
// returns 0 for "No Sign" or before the first packet.
uint8_t HasValidResult();

// A confirmed sign has passed the reference receiver's confidence and
// continuity filter. The confirmed values remain latched until another sign
// is confirmed or ClearConfirmedSign() is called.
uint8_t HasConfirmedSign();
uint8_t GetConfirmedLabelId();
uint8_t GetConfirmedConfidence();
void ClearConfirmedSign();

// Starts one fresh voting session after the car stops. Update() drains stale
// UART data, resets to Attempt 1, and then enables counting/printing. Wait for
// IsDecisionCollectionReady() before checking HasConfirmedSign().
void BeginDecisionCollection();
uint8_t IsDecisionCollectionReady();

// Ends the voting session. Update() continues reading UART during normal
// driving so the receive buffer stays empty, but results are not counted or
// printed until BeginDecisionCollection() is called again.
void EndDecisionCollection();

// Returns 1 while the automatic ACK_STOP / task / resume cycle is active.
uint8_t IsControlCycleActive();

// Returns 1 while valid UART packets are arriving. It becomes 0 when no valid
// packet has arrived within the library's private timeout.
uint8_t CheckAlive();

// Optional diagnostics useful when testing a new model or UART connection.
uint16_t GetFrameId();
uint8_t GetFlags();
uint32_t GetBytesReceived();
uint32_t GetPacketsOk();
uint32_t GetPacketsBad();

}  // namespace P4UartReceiver

#endif  // SMARTCAR_P4_UART_RECEIVER_HPP_
