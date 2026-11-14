# Similar projects for the same challenge

Researched 2026-11-14 with GitHub search (read-only). Search found well over 40 public repos for this exact challenge, many pushed in the last days. The projects below were cloned without checkout into a temporary folder and only their README and file lists were read. No code was run or copied. Four repos were empty or gone. Claims below come from each repo's own README, so they are what the teams say, not what we verified by running them.

No past-year winner for this challenge could be confirmed: it is new in 2026, and a web search found no award or nomination for any of these projects.

## Comparison

| Project | What it does | Real NASA data it names | Main strengths | Gaps |
|---|---|---|---|---|
| AURORA (fabriciojunio/aurora-astronaut-health) | Offline tablet app, personal baseline, rules engine with cited sources, radiation, 3-minute vigilance test (PVT-B), offline assistant, Isolation Forest | OSDR RadLab (DOSTEL, CRaTER, MSL-RAD), NOAA GOES, OSDR study metadata | Largest and most complete: 165 files, tests, signed data batches, model card, accessibility checks | Crew vitals simulated. No stated answer to astronauts hiding symptoms |
| AETHRA (sayma-sultana-isra/AETHRA) | Offline Next.js PWA, personal baseline, GREEN/AMBER/RED/UNKNOWN, body explorer, five hazards, emergency report, PDF/JSON/CSV | OSD-569 and others (11 files mention OSD ids) | Explainable flags, honest "UNKNOWN" state, scientific references page | Data unencrypted in browser. Thresholds unvalidated (its own words) |
| Crew Health Monitor (AdityaK0804) | Same readings judged by Earth rules and space-adapted rules side by side, 3D body, rule-based offline assistant | OSD-569 ranges, HRP hazards and risks pages | Clearest single idea, cites a source for every threshold or labels it "Demo parameter" | Simulated readings. Live demo uses a shared PIN |
| ARES-MED OS (Mottii, Almaty) | Body map with organ cascades, autonomous medical-officer triage console, light-delay aware | OSDR, RadLab, CSA radiation guidance | Strong body-map and triage story | Heavy on invented clinical logic |
| VITALS (noor-hossain13) | Replays simulated telemetry, personal ±2 SD band, 48-hour multi-signal rule, plain summaries | OSDR metadata (OSD-575, 656) | Deterministic, no AI, tested | Narrow: detection only |
| AstroMind (Mahdi-hasan-shuvo) | Documentation-first plan with prediction, companion, playbooks | OSDR | Detailed design docs, a private medical check-in with a contentless alert | No working app yet by its own status line |
| MAITRI (Shashank0316) | Offline multimodal mood from voice and face | NOAA GOES | Only team using audio and video | Mood only, privacy risk of face and voice |
| COSMOCare (omkargurav0216-code) | FastAPI, Isolation Forest, explainable risk, LLM chatbot | none named | Standard ML dashboard | Most generic, needs a network and an LLM |
| AL-KASAV (meherpurtv71-sketch) | Webcam pose tracking, simulated vitals, ISS radiation | RadLab | Camera idea | Small, 3 files |

## What is crowded (do not lead with these)

- Personal baseline instead of population ranges. At least AURORA, AETHRA, VITALS, AstroMind, Crew Health Monitor and AstroHealth do it.
- Offline and installable. AURORA, AETHRA, Crew Health Monitor, MAITRI.
- Explain every alert and cite a source. AURORA, AETHRA, Crew Health Monitor.
- Radiation dose from RadLab. AURORA, ARES-MED, AL-KASAV.
- Body map. ARES-MED, Crew Health Monitor, AETHRA.
- AI chatbot or assistant. Several.

Our current pitch ("private, offline, personal baseline") overlaps all of these. It would not stand out.

## Consent and sharing: already built by others (corrected)

Note 2026-11-14: the team moved to an open record (ground sees the full record, the astronaut sees everything ground sees). This section is now context only. Still to check: does any other team show the flight surgeon's notes to the astronaut?

My first draft said nobody had per-item consent. That was wrong. After reading the README and docs of four repos:

- **AURORA** (also read in its source: `apps/web/src/ui/PrivacyView.tsx`, `sync/outgoing.ts`) has a consent matrix by audience and data category, builds a ground batch of consented records, sends it with a simulated Mars delay, and writes an audit entry. No view of the batch contents before sending and no astronaut-written question were found. In its docs it has a consent module, "nothing shared by default; per-category, per-audience consent; notes stripped unless allowed", signed batches to ground containing "consented data only", a chained audit trail, and a threat model. This is the same mechanism we planned. It is strong and tested.
- **AstroMind** (documentation only, no working app) has per-field switches such as `share_wellbeing_detail_with_commander`, redaction of fields, and an audit log.
- **AETHRA** has an emergency report built only from the person's own data and says nothing is transmitted. No per-item consent found.

So the mechanism is not our edge. Do not pitch "per-item sharing" as new.

## What still looks open (in the ~12 repos read)

- **The underreporting problem itself.** In the repos read, "grounded" appears only for psychological grounding exercises, and no README names fear of being grounded, or astronauts hiding symptoms, as the design problem. AURORA frames consent as privacy and threat modeling. Our research (National Academies, "Safe Passage", ch. 8) treats underreporting as the reason monitoring fails. Building around that is a different story, even if the consent mechanism is similar.
- **Crew versus Mission Control friction and consult, not command.** Our research says the hardest interpersonal problem is crew versus ground, and that ground should move from directing to consulting. No repo in the sample models a consult.
- **An astronaut-led consult brief**: the astronaut chooses the data, writes the question, and sees exactly what ground will receive before sending. No repo in the sample generates one.

Caveat: this is a sample of about a dozen of 40+ repos, from their own READMEs. Repos change daily. Another team may add something similar before submission.

## Datasets used by others (and what that means for us)

| Dataset | Used by | Notes |
|---|---|---|
| OSDR OSD-569 (CBC with ranges) | Crew Health Monitor, AETHRA | Common, not an edge |
| OSDR RadLab (radiation) | AURORA, ARES-MED, AL-KASAV | Heavily used |
| NOAA GOES (solar protons) | AURORA, MAITRI | Not NASA, but used |
| OSDR metadata (OSD-575, 656) | VITALS | Light use |
| NLSP Standard Measures | few or none found | Easy to use to justify our indicator list |
| HRP risks, hazards, evidence reports | Crew Health Monitor | Light use of the evidence reports |

Our edge is not the dataset. It is how we use data. One caution on OSD-569: its min and max are Earth lab reference ranges. Crew Health Monitor's README says some blood values (such as white cells and lymphocytes) change in flight and that Earth rules would raise false alarms (per their README, to verify). So we show OSD-569 ranges as an "Earth reference" beside the astronaut's own baseline, and let the personal baseline drive alerts.
