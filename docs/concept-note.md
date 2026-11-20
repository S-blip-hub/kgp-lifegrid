# Concept note

**KGP LifeGrid: No-Life-Lost AIoT student safety infrastructure**
Technology readiness: **TRL 2, technology concept formulated.**

## Mission

To make IIT Kharagpur a No-Life-Lost campus by making sure that no student in crisis, danger, accident, violence, medical emergency, isolation or self-harm risk remains unnoticed, unreachable or without verified human support.

> No student unseen. No emergency unanswered. No preventable life lost.

## Problem

The problem is not that students have no phone numbers or no counselling access. On a large residential campus (about 2,100 acres, close to 10,000 students and 21 halls of residence), a serious incident can still depend on luck: someone has to notice the danger, know whom to contact, explain the exact location, reach the right responder and make sure someone follows up. In a fight, an accident, a medical collapse, an incident in an unsafe area or a self-harm crisis, that chain can break.

| Failure point | LifeGrid design response |
|---|---|
| Student cannot call or explain where they are | The nearest LifeNode sends a location-tagged SOS |
| A fight or harassment needs urgent but discreet help | Raksha Node offers silent or audible SOS routed to security with location and case status |
| A medical emergency needs fast routing | MedAlert routes to authorised security and medical responders under the SOP |
| A student becomes isolated or at risk of self-harm | Jeevan Kavach escalates concern through authorised care-circle and counselling workflows |
| Unsafe locations stay anecdotal | SafeRoute and HazardGrid collect repeated risk signals for lighting, access and design fixes |
| An alert is sent but nobody follows up | The closed-loop dashboard tracks received, assigned, reached, safe and closed |

## Solution

Smart **LifeNodes** plus a **closed-loop response dashboard**. LifeNodes provide one-touch SOS for fight or violence, medical emergency, accident, harassment, fire or electrical hazard and mental-health crisis escalation. Alerts reach authorised responders with the exact location and stay open until help has reached the student and safety is confirmed.

## What makes it different

LifeGrid is not another app, not a CCTV proposal, not a grievance portal and not a replacement for SETU or SARTH. It is a physical-digital safety layer that connects **location, category, response ownership and verified closure**, and complements the institute's existing security, hospital, counselling and hall systems.

| Module | Purpose |
|---|---|
| LifeNode | Visible public safety node: SOS, category buttons, optional intercom, location identity, tamper alert |
| Raksha Node | Fight, violence, harassment, threat or ragging-type concerns routed to security |
| Jeevan Kavach | Human-led crisis and self-harm prevention with same-day, 24 h and 72 h follow-up |
| MedAlert | Accident and medical emergency routing |
| SafeRoute and HazardGrid | Unsafe-zone, dark-route, access-risk and fire or electrical hazard reporting |
| Command dashboard | Tracks every alert until verified safety closure |

## Deep-tech rationale

IoT safety nodes, location-aware event routing, AI-assisted alert prioritisation and duplicate suppression, privacy-preserving safety analytics and closed-loop response dashboards. AI is **not** used to diagnose mental health. It helps prioritise, route and learn from safety signals under human oversight.

## Pilot

A 90-day **Safe Hall + Safe Corridor** pilot: five LifeNodes, a dashboard mock-up, an emergency-routing simulation, mock drills, a privacy review and student usability feedback. See [pilot-plan.md](pilot-plan.md).

## IP position

No institutional IP is involved at this stage and no patent has been filed. Potential IP after prototype validation includes the LifeNode configuration, the alert-routing workflow, privacy-preserving analytics and the dashboard architecture.
