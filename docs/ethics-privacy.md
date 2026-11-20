# Ethics, privacy and safety protocol

LifeGrid is designed as **student-protection infrastructure, not a surveillance system**. It must never shame, label or punish students for distress. It routes serious safety signals to authorised people with the minimum necessary data and verified follow-up.

## Non-negotiable guardrails

| Area | Guardrail |
|---|---|
| Private communication | No reading of WhatsApp, Instagram, email or private messages |
| Hostel privacy | No cameras inside rooms or private hostel spaces |
| Mental health | No AI diagnosis and no automated labelling of a student as suicidal |
| Escalation | Serious crisis alerts go only to authorised people under an institute-approved protocol |
| Data access | Security sees emergency location and category; counselling sees approved crisis details only; admin sees anonymised analytics unless authorised |
| Retention | Emergency logs are kept only as long as institute protocol and law require |
| Misuse | Emergency use is never blocked; false alarms are classified after safety is secured |
| Transparency | Students know what LifeGrid collects, why, who sees it and how to raise concerns |

## How the code reflects this

- `backend/src/access.ts` gives each role its own view. Care notes are stored only through the counselling role and appear only in the counselling view. Admin receives counts by category, zone and hour, with no case ids, people or notes.
- `backend/src/lifecycle.ts` refuses to classify a case as a false alarm before safety is confirmed.
- The drill log and the dashboard are the control-room record and never include care notes.
- LifeNodes send a node id, a category, a sequence number and a silent flag. They carry no personal data.

## Risk register

| Risk | Control |
|---|---|
| Surveillance concern | No room cameras, no private chat reading, public-node data only where approved |
| Mental-health misclassification | No AI diagnosis; crisis alerts trigger human review under the counselling protocol |
| False alarms or misuse | Emergency use never blocked; audit trail; repeated misuse reviewed after safety is assured |
| Data exposure | Role-based access, minimal data, retention limits, encrypted logs in the prototype |
| Operational overload | Start with one hall and one corridor, and mock drills before any live use |
| Institutional sensitivity | Positioned as strengthening SETU, SARTH, security, medical and hall systems, not replacing them |

## What can and cannot be claimed

At TRL 2 the project can claim a formulated, privacy-preserving system concept and pilot protocol. It does **not** claim to guarantee zero deaths, and it does not claim a deployed prototype. The promise is a mission toward zero preventable loss of life through a closed-loop campus safety system.

If you or someone you know is struggling, please reach out to the institute counselling centre or a trusted person. In India, the Tele-MANAS helpline is available at 14416.
