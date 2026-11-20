# Pilot plan and budget

**Objective:** validate the concept through a limited, privacy-preserving **Safe Hall + Safe Corridor** pilot that produces technical and operational evidence, moving from TRL 2 to TRL 3/4 without claiming campus-wide deployment.

## 90-day plan

| Weeks | Action | Evidence produced |
|---|---|---|
| 1–2 | Stakeholder review, site shortlist, privacy and SOP draft, responder mapping | Pilot boundary, risk register, approval plan |
| 3–4 | Bench-level LifeNode mock-up and dashboard wireframe | Hardware mock-up, clickable dashboard, design log |
| 5–6 | Simulate fight, medical, hazard and crisis alerts | Routing logs and response status records |
| 7–8 | Volunteer usability test and mock drill | Survey, response timing, false-alarm classification |
| 9–12 | Controlled demonstration and final evidence report | Metrics, learning report, TRL 3/4 recommendation |

The software in this repository covers the routing-simulation and dashboard parts of weeks 3–6.

## Pilot metrics

| Metric | Target | Drill simulation (seed 7) |
|---|---|---|
| Alert transmission success | > 95% in controlled tests | 100% |
| Acknowledgement time | Measured; aim below 60 s | median 20.6 s; 88.5% within 60 s |
| Verified closure rate | 100% in drills | 100% |
| Usability score | > 4/5 from student volunteers | to be measured with volunteers |
| Privacy acceptance | No unresolved critical concern | to be measured with volunteers |
| False-alarm classification | Every false or duplicate case labelled | 100% classified; 12 repeat presses merged |
| Follow-up completion | 24 h and 72 h checks completed in test cases | 100% completed, 92.1% within two hours of falling due |

The simulation figures come from synthetic drills with assumed responder behaviour (8% missed first pickups, 15% repeat presses, 10% false alarms). They test the workflow logic; they are not evidence of real-world performance.

## Indicative budget

| Head | Amount (Rs.) | Purpose |
|---|---|---|
| LifeNode components and enclosures | 1,20,000 | Buttons, microcontroller, speaker and microphone option, signage, enclosures |
| Dashboard and backend prototype | 90,000 | Alert lifecycle dashboard, routing simulation, logs |
| Connectivity and testing | 45,000 | SIM and Wi-Fi testing, backup power, reliability checks |
| UX, signage and awareness | 35,000 | Instructions, posters, volunteer onboarding |
| Safety and privacy review, documentation | 60,000 | Ethics, SOP, privacy and crisis-protocol consultation |
| Pilot operations and mock drills | 55,000 | Volunteer tests, drills, data collection, reports |
| Contingency and compliance buffer | 45,000 | Unexpected pilot needs |
| **Total** | **4,50,000** | Within a Rs. 5 lakh ideation-grant framing |

## Skills to bring in

IoT hardware and embedded systems, AI-assisted alert prioritisation, cybersecurity, privacy compliance, emergency-response workflow design and mental-health crisis protocol design: through technical co-founders from CSE, ECE and EE, faculty mentorship, and work with the counselling, security, hall and medical teams before any pilot.
