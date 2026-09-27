#ifndef MIXLY_TFLITE_UART_BRIDGE_HPP
#define MIXLY_TFLITE_UART_BRIDGE_HPP

#include <cstdint>

// UART communication bridge between ESP32-P4 (AI Eye) and ESP32-S3 (AI Body).
//
// Protocol (8 bytes per packet):
//   [0xAA] [0x55] [msg_type] [frame_id_lo] [frame_id_hi] [label_id] [confidence_u8] [flags]
//
// Confidence is sent as uint8_t (0-255), mapped to 0.0-1.0 on the receiver.
// Default baud rate: 921600

namespace UARTBridge {

// ---- P4 (Sender) API ----

// Initialize UART for sending inference results (P4 side).
// txPin/rxPin: UART pin assignments.
// baudRate: communication speed (default 921600).
// Returns true on success.
bool InitTX(int txPin, int rxPin, int baudRate = 921600);

// Send an inference result packet to the S3.
// labelId: predicted class index.
// confidence: confidence value 0.0-1.0 (will be quantized to uint8_t).
// frameId: optional frame counter.
void SendResult(int labelId, float confidence, uint16_t frameId = 0);

// ---- S3 (Receiver) API ----

// Initialize UART for receiving inference results (S3 side).
// txPin/rxPin: UART pin assignments.
// baudRate: communication speed (default 921600).
// Returns true on success.
bool InitRX(int txPin, int rxPin, int baudRate = 921600);

// Poll the UART and parse any available packets.
// Returns true if a new complete packet was received.
bool Update();

// Check if a new (unread) result is available.
bool HasNewResult();

// Get the label ID from the last received packet.
int GetLabelId();

// Get the confidence from the last received packet (0.0-1.0).
float GetConfidence();

// Get the frame ID from the last received packet.
uint16_t GetFrameId();

} // namespace UARTBridge

#endif
