---
title: "Compound — Master Plan"
subtitle: "Closed-loop neural UX analyser"
event: "To The Americas Hackathon — April 25–26, 2026"
team: "Apple ML intern · Imperial CS · 3x hackathon winner"
---

# Compound — Master Plan

**One paragraph.** Paste a URL. We render the site, run it through Meta's TRIBE v2 brain-encoder, run perturbation analysis to find the section with weakest predicted attention, generate a redesigned version of that section with image-gen, and show predicted uplift in a beautiful before/after report. Demo uses TRIBE v2 (CC BY-NC) as a research prototype; the commercial product roadmap trains a proprietary model on collected data. Founding-user deposits at £9.

---

## 1. The picture (end-to-end)

```mermaid
---
config:
  look: handDrawn
  theme: base
---
flowchart LR
    URL[/"User pastes URL<br/>e.g. airbnb.com"/]:::input

    subgraph V1["WEBSITE v1"]
        direction TB
        Render["Render scrolling video"]
        Sections["Split into sections<br/>nav · hero · features · CTA · footer"]
        Render --> Sections
    end

    subgraph CORE["NEURAL ANALYSIS LOOP"]
        direction TB
        Tribe(["TRIBE v2<br/>brain encoder"])
        Perturb["Perturbation:<br/>occlude each section,<br/>diff activations"]
        Score["Score sections<br/>by attention contribution"]
        Pick["Pick weakest<br/>role-misaligned section"]
        Tribe --> Perturb --> Score --> Pick
    end

    subgraph REDESIGN["REDESIGN"]
        direction TB
        ImageGen["Image-gen delta<br/>targeted section rewrite"]
        Reinfer(["TRIBE v2 re-infer<br/>on v2 patch"])
        Verdict["Predicted uplift<br/>v1 vs v2"]
        ImageGen --> Reinfer --> Verdict
    end

    subgraph V2["WEBSITE v2"]
        direction TB
        Report["Beautiful report<br/>before/after + heatmap<br/>+ LLM rationale"]
    end

    URL --> V1 --> CORE --> REDESIGN --> V2

    classDef input fill:#cfe8ff,stroke:#1f6feb,stroke-width:2px
    classDef proc fill:#fff4cc,stroke:#b58900,stroke-width:2px
    classDef out fill:#d9f7be,stroke:#389e0d,stroke-width:2px
    class V1 proc
    class CORE proc
    class REDESIGN proc
    class V2 out
```

This is the whole product in one picture. Everything below is detail.

---

## 2. Closed-loop architecture (what happens inside "neural analysis")

```mermaid
---
config:
  look: handDrawn
  theme: base
---
flowchart TB
    Start[/"256x256 screenshot<br/>or section patches"/]

    Start --> TribeFull(["TRIBE v2<br/>full page"])
    TribeFull --> Vfull[("Activation vector v_full<br/>20k-dim")]

    Start --> Mask["Mask section i<br/>i ∈ {nav, hero, ...}"]
    Mask --> TribeMask(["TRIBE v2<br/>masked page"])
    TribeMask --> Vmask[("Activation vector v_mask_i")]

    Vfull --> Diff["Diff = ||v_full − v_mask_i||<br/>= contribution of section i"]
    Vmask --> Diff

    Diff --> Heatmap["Section heatmap<br/>one score per section"]
    Heatmap --> RoleCheck{"Section role check<br/>CTA invisible?<br/>Footer dominating?"}

    RoleCheck -->|Misaligned| Target["Target = misaligned section"]
    RoleCheck -->|All aligned| GoodPage["Page is balanced<br/>recommend cosmetic v2"]

    Target --> LLM(["LLM:<br/>diagnose the issue<br/>propose 1 redesign"])
    GoodPage --> LLM

    LLM --> Gen(["Image-gen:<br/>render targeted edit"])
    Gen --> Patch[/"v2 section patch"/]

    Patch --> TribeV2(["TRIBE v2 on v2 patch"])
    TribeV2 --> Vpatch[("Activation vector v_patch")]
    Vpatch --> Compare["Predicted uplift =<br/>change in attention<br/>where role expects it"]

    Compare --> Report[/"Final report<br/>before/after + rationale"/]

    classDef store fill:#ffe7c7,stroke:#a35a00
    classDef model fill:#e0d4ff,stroke:#5a3eaa
    classDef io fill:#cfe8ff,stroke:#1f6feb
    class Vfull,Vmask,Vpatch store
    class TribeFull,TribeMask,TribeV2,LLM,Gen model
    class Start,Patch,Report io
```

**Key invariant:** we never claim TRIBE outputs are "brain activity." We say "predicted brain-space representation." Recommendations are LLM-authored over those representations. License attribution shown in footer of every report.

---

## 3. Service architecture

```mermaid
---
config:
  look: handDrawn
  theme: base
---
flowchart LR
    User((User))

    subgraph Frontend["Frontend · Next.js · Render"]
        Landing["Landing page<br/>+ sample outputs"]
        AppUI["Analysis UI<br/>+ result viewer"]
        Pay["Stripe checkout<br/>founding-user deposit £9"]
    end

    subgraph API["API Service · FastAPI · Render"]
        Submit["POST /analyze<br/>queue job"]
        Status["GET /jobs/:id<br/>poll status"]
        Webhook["POST /stripe/webhook"]
    end

    subgraph Worker["Inference Worker · Render Background"]
        Browser["Headless browser<br/>screenshot + scroll video"]
        TribePipe(["TRIBE v2<br/>perturbation loop"])
        LLMCall(["LLM<br/>insight + delta prompt"])
        ImgGen(["Image-gen<br/>section rewrite"])
        Browser --> TribePipe --> LLMCall --> ImgGen
    end

    DB[(Postgres · Render<br/>users · jobs · analyses)]
    Cache[("Object store<br/>screenshots · outputs")]

    Logfire(("Logfire<br/>traces"))
    Mubit(("Mubit<br/>execution memory"))

    User --> Landing --> Pay --> Webhook
    User --> AppUI --> Submit --> DB
    Submit --> Worker
    Worker --> Cache
    Worker --> DB
    AppUI -.poll.-> Status

    Worker -.spans.-> Logfire
    Worker -.reflections.-> Mubit
    LLMCall -.reads.-> Mubit

    classDef ext fill:#e0d4ff,stroke:#5a3eaa
    classDef store fill:#ffe7c7,stroke:#a35a00
    class Logfire,Mubit ext
    class DB,Cache store
```

**Sponsor integration sites marked.** Logfire traces every span in the worker. Mubit stores reflections from each analysis ("this redesign pattern increased predicted uplift") and reads them on the next run.

---

## 4. 24-hour execution timeline

```mermaid
---
config:
  look: handDrawn
  theme: base
---
gantt
    title Hackathon Execution — Saturday 11:00 → Sunday 11:00
    dateFormat HH:mm
    axisFormat %H:%M

    section Foundation
    Repo + Render + Stripe scaffold     :done, h0, 11:00, 2h
    TRIBE v2 boot + first inference     :crit, h0a, 11:00, 3h
    Image-gen pilot on Airbnb           :h0b, 11:00, 2h

    section Gates
    Gate 1 cat-vs-Airbnb cosine test    :crit, gate1, 14:00, 1h
    Gate 2 image-gen plausibility       :gate2, 13:00, 1h
    Scope-lock decision (1d vs 4d)      :milestone, lock, 15:00, 0

    section Build
    Perturbation loop                   :h1, 15:00, 4h
    Section role classifier             :h1b, 15:00, 2h
    LLM insight prompt + Pydantic AI    :h2, 16:00, 4h
    Image-gen delta integration         :h3, 17:00, 4h
    Mubit reflection loop               :h3b, 19:00, 2h

    section UI
    Output report design                :h4, 13:00, 6h
    Landing + sample outputs cached     :h4b, 14:00, 4h
    Payment flow (deposits)             :h5, 18:00, 3h

    section Integration
    End-to-end first run                :crit, ee, 21:00, 2h
    Logfire wiring                      :h6, 22:00, 1h
    Render multi-service deploy         :h6b, 23:00, 2h

    section Sleep
    Sleep window 1 (2 of 3)             :sleep1, 01:00, 4h
    Sleep window 2 (rotating)           :sleep2, 05:00, 3h

    section Distribution
    HN Show post (US morning)           :crit, hn, 02:00, 1h
    Twitter thread + screenshots        :tw, 03:00, 1h
    Indie Hackers post                  :ih, 04:00, 1h
    Personal network outreach           :pn, 04:00, 4h

    section Final
    Pitch script + 3 rehearsals         :pitch, 06:00, 2h
    Bug bash + demo path test           :bb, 08:00, 1h
    Submission (1h before deadline)     :crit, sub, 12:00, 1h
```

**Hour 0 = doors open, 11:00 Saturday.** Hour 24 = submission deadline 13:00 Sunday (per official spec). Adjust if start-time shifts.

---

## 5. Decision tree — which version we ship

```mermaid
---
config:
  look: handDrawn
  theme: base
---
flowchart TD
    Start([Hackathon hour 4 · scope lock])

    Start --> G1{"Gate 1 passed?<br/>TRIBE differentiates<br/>cat vs Airbnb<br/>vs broken-CTA Airbnb"}

    G1 -->|"YES strong"| G2{"Gate 2 passed?<br/>Image-gen produces<br/>plausible section edit"}
    G1 -->|"YES marginal"| Frozen["Ship: tribeV2 heatmap<br/>+ LLM critique<br/>(no delta)"]
    G1 -->|NO| Pivot

    G2 -->|YES| G3{"Time budget<br/>at hour 12?"}
    G2 -->|NO| Param["Ship: 1-delta<br/>parametric edits only<br/>(contrast, font, position)"]

    G3 -->|"On track"| FourDelta["Ship: 4-delta<br/>ranked closed loop<br/>aspirational"]
    G3 -->|"Behind"| OneDelta["Ship: 1-delta<br/>before/after<br/>committed baseline"]

    Pivot["PIVOT: AudienceSim<br/>simulated personas<br/>review + iterate"]

    FourDelta --> Final([Demo + pitch])
    OneDelta --> Final
    Param --> Final
    Frozen --> Final
    Pivot --> Final

    classDef good fill:#d9f7be,stroke:#389e0d
    classDef warn fill:#fff4cc,stroke:#b58900
    classDef bad fill:#ffd6d6,stroke:#cf222e
    class FourDelta good
    class OneDelta good
    class Param warn
    class Frozen warn
    class Pivot bad
```

**Default = OneDelta.** Earn the right to FourDelta by passing Gate 2 + arriving at hour 12 on time. Never let perfect kill committed.

---

## 6. Sponsor integration map

```mermaid
---
config:
  look: handDrawn
  theme: base
---
flowchart LR
    Product["Compound product"]

    subgraph Mubit["Mubit · £808 bounty"]
        MubitLoop["@mubit.learn.run on<br/>delta-generation agent<br/>remembers redesign patterns<br/>that improved uplift"]
    end

    subgraph Cog["Cognition · £538 bounty"]
        Devin["Devin tickets:<br/>component scaffolding<br/>+ test harness"]
        Wind["Windsurf as IDE<br/>for all coding"]
    end

    subgraph Pyd["Pydantic · £500 bounty"]
        PAI["Pydantic AI orchestrates<br/>perturb-LLM-imagegen agent"]
        Schema["Pydantic schemas:<br/>SectionScore, Insight,<br/>RedesignDelta"]
        LF["Logfire traces<br/>every inference span"]
    end

    subgraph Render["Render · £538 bounty"]
        FE["Frontend service"]
        BE["API service"]
        WK["Background worker"]
        PG[("Managed Postgres")]
    end

    subgraph Social["Best social post · £500 bounty"]
        Thread["Build-in-public thread<br/>with sample outputs"]
    end

    Product --> MubitLoop
    Product --> Devin
    Product --> Wind
    Product --> PAI
    Product --> Schema
    Product --> LF
    Product --> FE & BE & WK & PG
    Product --> Thread

    classDef m fill:#e0d4ff,stroke:#5a3eaa
    classDef c fill:#cfe8ff,stroke:#1f6feb
    classDef p fill:#ffe7c7,stroke:#a35a00
    classDef r fill:#d9f7be,stroke:#389e0d
    classDef s fill:#ffd6d6,stroke:#cf222e
    class Mubit m
    class Cog c
    class Pyd p
    class Render r
    class Social s
```

**Effort budget:** Mubit + Cognition prioritised. Pydantic + Render natural fall-out of the build. Social post is 30 min near hour 24 — basically free.

---

## 7. Pitch sequence (3 minutes)

```mermaid
---
config:
  look: handDrawn
  theme: base
---
sequenceDiagram
    autonumber
    participant J as Judges
    participant P as Presenter (3x winner)
    participant ML as ML lead (Apple intern)
    participant Demo as Live demo

    Note over P,J: 0:00 — Hook
    P->>J: "You've shipped a landing page and wondered which section is doing its job. Heatmaps tell you where eyes went. Not how brains felt."

    Note over P,J: 0:15 — Demo setup
    P->>Demo: Paste airbnb.com
    Demo-->>P: Cached heatmap appears (pre-rendered, looks live)
    P->>J: "We modeled predicted brain-space response on the entire page."

    Note over P,J: 0:45 — Wow moment
    P->>Demo: Click "Generate v2"
    Demo-->>P: Before/after with predicted uplift
    P->>J: "Here's the v2 — predicted attention on the CTA up 14%."

    Note over P,J: 1:30 — Proof of demand
    P->>Demo: Show Stripe dashboard
    Demo-->>P: N founding-user deposits, last 24h
    P->>J: "Cold launch 22 hours ago. N developers paid £9 to be founding users."

    Note over P,J: 2:00 — Team and science
    P->>ML: Hand off
    ML->>J: "Built on Meta's TRIBE v2 (CC BY-NC research model). Zero-shot extrapolation to UIs is a bet — our roadmap trains a proprietary model on collected analysis data."
    ML->>J: Pre-empt the hard question

    Note over P,J: 2:30 — Vision
    P->>J: "Today: 1 redesign per analysis. Tomorrow: every team ships v2 with evidence of how users will respond before they see it."

    Note over P,J: 2:55 — Close
    P->>J: One-line ask
```

**Pitch principle:** Pattern 3 from the playbook (one wow moment) is the v2 reveal at 1:00. Pattern 8 (vision slide) is the closing. The license attribution at 2:00 turns the biggest credibility risk into a roadmap strength.

---

## 8. User journey · paying customer

```mermaid
---
config:
  look: handDrawn
  theme: base
---
flowchart TD
    Start([Lands on tribeux.io from HN/X]) --> See["Sees pre-rendered<br/>Airbnb sample output"]
    See --> Convinced{Convinced?}
    Convinced -->|No| Bounce([Bounces])
    Convinced -->|Yes| Input["Pastes their URL"]
    Input --> Pay["Pays £9 founding-user deposit"]
    Pay --> Wait["Watches progress<br/>scrape · TRIBE · LLM · v2-gen"]
    Wait --> Result["Sees their report"]
    Result --> Share{Shareable?}
    Share -->|Yes| Tweet["Tweets screenshot<br/>tags @tribeux"]
    Share -->|No| Done([Done])
    Tweet --> Loop["Loop: more traffic"]
    Loop --> Start

    classDef good fill:#d9f7be,stroke:#389e0d
    classDef bad fill:#ffd6d6,stroke:#cf222e
    class Tweet good
    class Bounce bad
```

**Conversion lever 1:** sample output BEFORE paywall. **Conversion lever 2:** result is screenshot-worthy by design (the v2 reveal is the share moment).

---

## 9. Risk register (live)

```mermaid
---
config:
  look: handDrawn
  theme: base
---
flowchart LR
    subgraph Tech["Technical risks"]
        R1["TRIBE v2 noise on websites"]
        R2["Image-gen produces slop"]
        R3["Inference too slow"]
        R4["Compound OOD on AI images"]
    end

    subgraph Legal["Legal risks"]
        L1["CC BY-NC commercial use"]
    end

    subgraph Exec["Execution risks"]
        E1["Scope creep · 4-delta"]
        E2["Integration left to end"]
        E3["No sleep · pitch degrades"]
    end

    subgraph Mit["Mitigations"]
        M1["Gate 1 tonight"]
        M2["Pre-cache 3 demo sites"]
        M3["Hour 4 scope lock"]
        M4["Founding-user deposits"]
        M5["Two 4h sleep windows"]
    end

    R1 --> M1
    R2 --> M1
    R3 --> M2
    R4 --> M2
    L1 --> M4
    E1 --> M3
    E2 --> M2
    E3 --> M5

    classDef risk fill:#ffd6d6,stroke:#cf222e
    classDef mit fill:#d9f7be,stroke:#389e0d
    class R1,R2,R3,R4,L1,E1,E2,E3 risk
    class M1,M2,M3,M4,M5 mit
```

---

## 10. Team roles

```mermaid
---
config:
  look: handDrawn
  theme: base
---
flowchart TB
    subgraph ML["Apple ML intern"]
        ML1["TRIBE v2 inference + perturbation"]
        ML2["Mubit reflection loop"]
        ML3["Defends science under Q&A"]
    end

    subgraph CS["Imperial CS"]
        CS1["Image-gen + section editor"]
        CS2["Pydantic AI orchestration"]
        CS3["Render multi-service deploy"]
    end

    subgraph WIN["3x winner · Leeds"]
        WIN1["Output UI · landing"]
        WIN2["Stripe + payments"]
        WIN3["Distribution + sales"]
        WIN4["Pitch ownership"]
    end

    subgraph Shared["All three"]
        S1["Hour 0–4: parallel scaffolding"]
        S2["Hour 4: scope lock together"]
        S3["Hour 21–23: end-to-end bug bash"]
        S4["Sleep rotation"]
    end

    ML --> Shared
    CS --> Shared
    WIN --> Shared

    classDef role fill:#cfe8ff,stroke:#1f6feb
    class ML,CS,WIN role
```

---

## 11. Pre-hack checklist (today, before 11:00)

- [ ] **Gate 1** — `cosine_similarity(tribe(airbnb), tribe(cat))` < 0.9 AND `cosine_similarity(tribe(airbnb), tribe(airbnb_invisible_cta))` < 1.0
- [ ] **Gate 2** — generate one targeted edit of Airbnb hero with image-gen; 3 humans say "designer mockup, not slop"
- [ ] **Stripe live** — sole-trader entity, founding-user-deposit checkout, T&Cs in place
- [ ] **Domain bought** — tribeux.io or equivalent
- [ ] **Render account + Pydantic Logfire account + Mubit signup**
- [ ] **3 demo sites pre-rendered** (Airbnb, Stripe, Linear) — saved as PNGs
- [ ] **Pitch script v0** — written, but not rehearsed yet
- [ ] **Sleep schedule** — assigned to teammates

---

## 12. Locked decisions (do not revisit during the hack)

| Decision | Choice | Why |
|---|---|---|
| Pricing | £9 founding-user **deposit** (refundable) | License + value density |
| Default ship | 1-delta before/after | Demo reliability over feature ambition |
| Aspiration | 4-delta ranked, behind hour-12 gate | Earn it, don't promise it |
| Sponsors prioritised | Mubit + Cognition | Concentrated effort |
| Sponsors natural | Pydantic + Render | Falls out of the build |
| Pitch frame | "Research prototype with commercial roadmap" | Defuses license + science questions |
| Demo path | Pre-cached Airbnb output, live only for payment | Pattern 1 (demo-first) |
| Scope lock | Hour 4 | No additions after hour 6 |
| Submission | Hour 23 (1h before deadline) | Pattern 10 (don't submit late) |

---

## Appendix · key links

- TRIBE v2 — `github.com/facebookresearch/tribev2` (CC BY-NC)
- Mubit — `mubit.ai`
- Pydantic AI + Logfire — `pydantic.dev`
- Render — `render.com`
- Cognition (Devin + Windsurf) — `cognition.ai`

## Appendix · core rule

**Do NOT optimize for activation magnitude. Optimize for role-aligned response.**
The right signal in the right region for that section's job. A nav bar with low activation is correct. A CTA with low activation is broken. Recommendations are LLM-authored interpretations of modeled brain-space representations — not measurements.
