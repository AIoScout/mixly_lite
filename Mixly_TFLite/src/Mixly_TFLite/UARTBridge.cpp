#include "UARTBridge.hpp"

#if defined(ESP32)
#include <HardwareSerial.h>

// Packet protocol constants
static constexpr uint8_t kSync0 = 0xAA;
static constexpr uint8_t kSync1 = 0x55;
static constexpr uint8_t kMsgTypeInference = 0x01;
static constexpr uint8_t kPacketSize = 8;

namespace UARTBridge {

// Shared state
static HardwareSerial* s_uart = nullptr;
static bool s_isSender = false;

// Receiver state
static bool s_hasNew = false;
static int s_lastLabelId = 0;
static float s_lastConfidence = 0.0f;
static uint16_t s_lastFrameId = 0;

// ---- Sender implementation ----

bool InitTX(int txPin, int rxPin, int baudRate) {
    s_isSender = true;
    s_uart = &Serial1;
    s_uart->begin(baudRate, SERIAL_8N1, rxPin, txPin);
    Serial.print("[UARTBridge] TX init on pins ");
    Serial.print(txPin); Serial.print("/"); Serial.println(rxPin);
    return true;
}

void SendResult(int labelId, float confidence, uint16_t frameId) {
    if (!s_uart || !s_isSender) return;

    uint8_t pkt[kPacketSize];
    pkt[0] = kSync0;
    pkt[1] = kSync1;
    pkt[2] = kMsgTypeInference;
    pkt[3] = (uint8_t)(frameId & 0xFF);
    pkt[4] = (uint8_t)((frameId >> 8) & 0xFF);
    pkt[5] = (uint8_t)labelId;
    pkt[6] = (uint8_t)(confidence * 255.0f);
    pkt[7] = 0; // flags reserved

    s_uart->write(pkt, kPacketSize);
    s_uart->flush();
}

// ---- Receiver implementation ----

bool InitRX(int txPin, int rxPin, int baudRate) {
    s_isSender = false;
    s_uart = &Serial1;
    s_uart->begin(baudRate, SERIAL_8N1, rxPin, txPin);
    Serial.print("[UARTBridge] RX init on pins ");
    Serial.print(rxPin); Serial.print("/"); Serial.println(txPin);
    return true;
}

bool Update() {
    if (!s_uart || s_isSender) return false;

    // State machine for sync detection + packet parsing
    static uint8_t buf[kPacketSize];
    static uint8_t idx = 0;
    static uint8_t state = 0;

    while (s_uart->available() > 0) {
        uint8_t b = (uint8_t)s_uart->read();

        if (state == 0) {
            // Scanning for first sync byte
            if (b == kSync0) {
                buf[0] = b;
                idx = 1;
                state = 1;
            }
            continue;
        }

        if (state == 1) {
            // Got 0xAA, looking for 0x55
            if (b == kSync1) {
                buf[1] = b;
                idx = 2;
                state = 2;
            } else if (b == kSync0) {
                // Re-sync: stay in state 1
                buf[0] = b;
                idx = 1;
            } else {
                state = 0;
                idx = 0;
            }
            continue;
        }

        // state == 2: collecting remaining bytes
        buf[idx++] = b;
        if (idx < kPacketSize) continue;

        // Full packet received, reset state machine
        state = 0;
        idx = 0;

        // Validate message type
        if (buf[2] != kMsgTypeInference) return false;

        // Parse packet
        s_lastLabelId = (int)buf[5];
        s_lastConfidence = (float)buf[6] / 255.0f;
        s_lastFrameId = (uint16_t)buf[3] | ((uint16_t)buf[4] << 8);
        s_hasNew = true;
        return true;
    }

    return false;
}

bool HasNewResult() {
    return s_hasNew;
}

int GetLabelId() {
    s_hasNew = false;
    return s_lastLabelId;
}

float GetConfidence() {
    return s_lastConfidence;
}

uint16_t GetFrameId() {
    return s_lastFrameId;
}

} // namespace UARTBridge

#else
// Stubs for non-ESP32 builds
namespace UARTBridge {
bool InitTX(int, int, int) { return false; }
void SendResult(int, float, uint16_t) {}
bool InitRX(int, int, int) { return false; }
bool Update() { return false; }
bool HasNewResult() { return false; }
int GetLabelId() { return 0; }
float GetConfidence() { return 0.0f; }
uint16_t GetFrameId() { return 0; }
}
#endif
