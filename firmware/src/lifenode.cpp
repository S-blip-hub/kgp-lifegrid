#include "lifenode.hpp"

#include <cstdio>

namespace lifegrid {

const char* code(Category c) {
    switch (c) {
        case Category::Medical: return "MED";
        case Category::Fight: return "FGT";
        case Category::Harassment: return "HAR";
        case Category::Hazard: return "HAZ";
        case Category::Crisis: return "CRS";
        case Category::UnsafeZone: return "UNS";
    }
    return "UNK";
}

uint8_t crc8(const std::string& data) {
    uint8_t crc = 0x00;
    for (unsigned char b : data) {
        crc ^= b;
        for (int i = 0; i < 8; ++i) {
            crc = (crc & 0x80) ? static_cast<uint8_t>((crc << 1) ^ 0x07) : static_cast<uint8_t>(crc << 1);
        }
    }
    return crc;
}

std::string encodeFrame(const std::string& nodeId, Category c, uint16_t seq, bool silent) {
    std::string body = "LG1;" + nodeId + ";" + code(c) + ";" + std::to_string(seq) + ";" + (silent ? "1" : "0");
    char tail[4];
    std::snprintf(tail, sizeof tail, "%02X", crc8(body));
    return body + "*" + tail;
}

LifeNode::LifeNode(std::string nodeId) : id_(std::move(nodeId)) {}

void LifeNode::buttonDown(Category c, uint32_t nowMs, bool silent) {
    if (nowMs - lastEdge_ < kDebounceMs && lastEdge_ != 0) return;
    lastEdge_ = nowMs;
    pressed_ = true;
    raisedThisPress_ = false;
    pressCat_ = c;
    pressSilent_ = silent;
    pressStart_ = nowMs;
}

void LifeNode::buttonUp(uint32_t nowMs) {
    if (nowMs - lastEdge_ < kDebounceMs) return;
    lastEdge_ = nowMs;
    pressed_ = false;
}

void LifeNode::tamper(uint32_t nowMs) {
    if (state_ == NodeState::Idle) raise(Category::Hazard, true, nowMs);
}

void LifeNode::raise(Category c, bool silent, uint32_t nowMs) {
    // A second alert while one is open re-sends the open case instead of
    // creating a new one; the backend merges repeats from the same node.
    if (state_ != NodeState::Idle && state_ != NodeState::Offline) {
        nextSend_ = nowMs;
        return;
    }
    ++seq_;
    pendingCat_ = c;
    pendingSilent_ = silent;
    frame_ = encodeFrame(id_, c, seq_, silent);
    state_ = NodeState::Sending;
    attempts_ = 0;
    retryGap_ = kFirstRetryMs;
    nextSend_ = nowMs;
}

std::vector<Frame> LifeNode::tick(uint32_t nowMs) {
    std::vector<Frame> out;
    if (pressed_ && !raisedThisPress_ && nowMs - pressStart_ >= kHoldMs) {
        raisedThisPress_ = true;
        raise(pressCat_, pressSilent_, nowMs);
    }
    const bool waiting = state_ == NodeState::Sending || state_ == NodeState::Offline;
    if (waiting && static_cast<int32_t>(nowMs - nextSend_) >= 0) {
        out.push_back({seq_, frame_});
        ++attempts_;
        if (state_ == NodeState::Sending && attempts_ >= kMaxFastRetries) {
            state_ = NodeState::Offline;
            retryGap_ = kSlowRetryMs;
        }
        nextSend_ = nowMs + retryGap_;
        if (state_ == NodeState::Sending) retryGap_ *= 2;
    }
    return out;
}

void LifeNode::onAck(uint16_t seq, uint8_t stage) {
    if (seq != seq_ || state_ == NodeState::Idle) return;
    if (stage >= 3) {
        state_ = NodeState::Idle;  // case closed by the control room
    } else if (stage == 2) {
        state_ = NodeState::HelpOnTheWay;
    } else if (state_ != NodeState::HelpOnTheWay) {
        state_ = NodeState::Acknowledged;
    }
}

}  // namespace lifegrid
