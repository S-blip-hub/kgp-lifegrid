// LifeNode alert logic.
//
// Hardware-independent core of a LifeNode: category buttons, press handling,
// alert frames, delivery retries and the status shown to the person at the
// node. The board layer (GPIO, radio, LEDs, speaker) calls into this class, so
// the logic can be unit-tested on a host machine before it is flashed.
#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace lifegrid {

enum class Category : uint8_t { Medical, Fight, Harassment, Hazard, Crisis, UnsafeZone };

// Three-letter codes used on the wire; the backend uses the same table.
const char* code(Category c);

// What the node shows on its status ring and speaks through the speaker.
enum class NodeState : uint8_t {
    Idle,          // ready
    Sending,       // alert raised, waiting for the control room to acknowledge
    Acknowledged,  // a human has the case
    HelpOnTheWay,  // a responder has accepted and is moving
    Offline,       // delivery failed: show intercom number and keep retrying slowly
};

struct Frame {
    uint16_t seq;
    std::string text;  // e.g. "LG1;H1-N2;MED;17;0*6B"
};

// CRC-8, polynomial 0x07, initial value 0x00 (check value 0xF4 for "123456789").
uint8_t crc8(const std::string& data);

// Builds "LG1;<node>;<category>;<seq>;<silent>*<crc>".
std::string encodeFrame(const std::string& nodeId, Category c, uint16_t seq, bool silent);

class LifeNode {
public:
    static constexpr uint32_t kDebounceMs = 300;    // ignore contact bounce
    static constexpr uint32_t kHoldMs = 1500;       // press must be held to raise an alert
    static constexpr uint32_t kFirstRetryMs = 2000; // doubled after every unacknowledged attempt
    static constexpr uint8_t kMaxFastRetries = 5;   // then fall back to Offline with slow retries
    static constexpr uint32_t kSlowRetryMs = 30000;

    explicit LifeNode(std::string nodeId);

    // Button edges from the board layer. A press counts once it is held for
    // kHoldMs, which keeps accidental brushes from raising alerts.
    void buttonDown(Category c, uint32_t nowMs, bool silent = false);
    void buttonUp(uint32_t nowMs);

    // Called from the main loop. Returns frames that must be transmitted now.
    std::vector<Frame> tick(uint32_t nowMs);

    // Acknowledgement from the backend for a sequence number.
    // stage 1 = case received by a human, 2 = responder on the way.
    void onAck(uint16_t seq, uint8_t stage);

    // Tamper switch on the enclosure: sends a hazard-class maintenance alert.
    void tamper(uint32_t nowMs);

    NodeState state() const { return state_; }
    uint16_t lastSeq() const { return seq_; }
    uint8_t attempts() const { return attempts_; }

private:
    void raise(Category c, bool silent, uint32_t nowMs);

    std::string id_;
    NodeState state_ = NodeState::Idle;
    uint16_t seq_ = 0;
    Category pendingCat_ = Category::Medical;
    bool pendingSilent_ = false;
    bool pressed_ = false;
    bool raisedThisPress_ = false;
    Category pressCat_ = Category::Medical;
    bool pressSilent_ = false;
    uint32_t pressStart_ = 0;
    uint32_t lastEdge_ = 0;
    uint32_t nextSend_ = 0;
    uint32_t retryGap_ = kFirstRetryMs;
    uint8_t attempts_ = 0;
    std::string frame_;
};

}  // namespace lifegrid
