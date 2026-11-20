// Host-side tests for the LifeNode logic: g++ -std=c++17 and run.
#include <cstdio>
#include <cstdlib>
#include <string>

#include "lifenode.hpp"

using namespace lifegrid;

static int failures = 0;
#define CHECK(cond)                                                         \
    do {                                                                    \
        if (!(cond)) {                                                      \
            std::fprintf(stderr, "%s:%d: CHECK failed: %s\n", __FILE__, __LINE__, #cond); \
            ++failures;                                                     \
        }                                                                   \
    } while (0)

static void crc_matches_reference() {
    CHECK(crc8("123456789") == 0xF4);
    CHECK(encodeFrame("H1-N2", Category::Medical, 17, false) == "LG1;H1-N2;MED;17;0*6B");
    CHECK(encodeFrame("CR-N4", Category::Fight, 3, true) == "LG1;CR-N4;FGT;3;1*90");
}

static void short_press_does_not_raise_alert() {
    LifeNode n("H1-N1");
    n.buttonDown(Category::Medical, 1000);
    n.buttonUp(1800);  // released before the hold time
    CHECK(n.tick(5000).empty());
    CHECK(n.state() == NodeState::Idle);
}

static void held_press_sends_once_and_stops_on_ack() {
    LifeNode n("H1-N1");
    n.buttonDown(Category::Medical, 1000);
    CHECK(n.tick(2000).empty());
    auto frames = n.tick(2600);
    CHECK(frames.size() == 1);
    CHECK(frames[0].seq == 1);
    CHECK(n.state() == NodeState::Sending);
    n.buttonUp(3000);
    n.onAck(1, 1);
    CHECK(n.state() == NodeState::Acknowledged);
    CHECK(n.tick(60000).empty());
    n.onAck(1, 2);
    CHECK(n.state() == NodeState::HelpOnTheWay);
    n.onAck(1, 3);
    CHECK(n.state() == NodeState::Idle);
}

static void retries_back_off_then_go_offline() {
    LifeNode n("CR-N3");
    n.buttonDown(Category::Fight, 0, true);
    uint32_t t = LifeNode::kHoldMs;
    int sent = 0;
    uint32_t lastSend = 0;
    uint32_t gaps[8] = {};
    for (; t < 200000 && n.state() != NodeState::Offline; t += 100) {
        auto f = n.tick(t);
        if (!f.empty()) {
            if (sent > 0) gaps[sent - 1] = t - lastSend;
            lastSend = t;
            ++sent;
        }
    }
    CHECK(sent == LifeNode::kMaxFastRetries);
    CHECK(gaps[0] == 2000 && gaps[1] == 4000 && gaps[2] == 8000);
    // offline nodes keep trying, slowly
    bool resent = false;
    for (uint32_t u = t; u < t + LifeNode::kSlowRetryMs + 200; u += 100) resent |= !n.tick(u).empty();
    CHECK(resent);
}

static void stale_ack_is_ignored() {
    LifeNode n("H1-N2");
    n.buttonDown(Category::Crisis, 0);
    n.tick(LifeNode::kHoldMs);
    n.onAck(99, 2);
    CHECK(n.state() == NodeState::Sending);
}

static void tamper_raises_silent_hazard() {
    LifeNode n("H1-N3");
    n.tamper(500);
    auto f = n.tick(500);
    CHECK(f.size() == 1);
    CHECK(f[0].text.rfind("LG1;H1-N3;HAZ;1;1*", 0) == 0);
}

int main() {
    crc_matches_reference();
    short_press_does_not_raise_alert();
    held_press_sends_once_and_stops_on_ack();
    retries_back_off_then_go_offline();
    stale_ack_is_ignored();
    tamper_raises_silent_hazard();
    if (failures) {
        std::fprintf(stderr, "%d check(s) failed\n", failures);
        return EXIT_FAILURE;
    }
    std::puts("lifenode: all tests passed");
    return EXIT_SUCCESS;
}
