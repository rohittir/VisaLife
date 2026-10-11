# VisaLife — Product Requirements Document (Phase 1)

## A1. Problem

An Indian national on H-1B, H-4 or F-1 has to track a dozen expiry dates, know which form to
file when, watch a monthly Visa Bulletin for a priority date that moves by weeks per year, and
follow rule changes that can land overnight. The official answers exist on USCIS, CBP, DHS/SEVP,
the State Department, the Federal Register and Congress.gov, but they are scattered and never
personalized. People rely on WhatsApp groups and forums, and miss simple, costly things:
an I-94 that was shortened at entry, a travel signature that expired, an extension window that
closed, an H-4 EAD they were already eligible for.

## A2. Product in one sentence

**VisaLife tells you the few things you must check right now, based on your visa, your stage and
what is happening in your life, and links you straight to the official page to do it.**

## A3. Goals and non-goals

Goals (Phase 1)
1. A user with no account answers 3 questions and immediately sees a short, correct checklist
   of things to confirm, each with an official link.
2. Every expiry date they enter becomes a countdown and a timed check ("extension can be filed
   from …", "apply for STEM OPT by …").
3. H-1B/H-4 users see their priority date against this month's Visa Bulletin and get told the
   month it becomes current for filing.
4. A policy feed shows only the bills, rules and executive actions that touch *their* visa,
   with a plain-English "what it means for you" for the important ones.
5. Signing in (Google or email code) syncs the same profile across devices. Nothing else is
   gated behind sign-in.

Non-goals (Phase 1)
- Legal advice, case strategy, lawyer matching, community/forum, chat assistant.
- Other nationalities; L-1, B-1/B-2, J-1, O-1, green-card holders.
- Live USCIS case status (API needs developer approval), live processing times, consulate
  wait-time scraping, push/email alerts (Phase 1b after SES production access).
- Storing receipt numbers, A-numbers, SSNs, passport numbers or document uploads.

## A4. Users (Phase 1 personas)

| Persona | Situation | What they need from Home |
|---|---|---|
| **Priya, H-1B, EB-2 India, PD 2014** | 11 years in, I-140 approved, 3-year extensions, spouse on H-4 EAD, kid is 17 | PD vs bulletin, extension timing, kid aging-out warning, H-4 EAD renewal, travel/stamping reality |
| **Arjun, H-1B, year 2, no PERM yet** | Changing employers, travelling to India in December | Portability rules ("start on receipt"), what to carry, visa appointment/stamping checks, 60-day grace if laid off |
| **Neha, H-4** | Primary's I-140 approved last month | "You are eligible for H-4 EAD now", how to apply, what not to do (no work before EAD) |
| **Rohan, F-1 on STEM OPT** | Year 1 of STEM OPT, not selected twice | Unemployment-day counter, I-983 evaluation due date, lottery season checklist, options if not selected |

## A5. Design principles

1. **Very simple.** Four tabs (Today, Journey, Policy, Me). Today is one thing to do next, up to
   two fact tiles and a quiet list. No dashboards, no charts beyond one priority-date tile (with a
   detail view and one 12-month sparkline).
2. **Ask, don't lecture.** Each check is a yes/no question in plain English, with one line on
   why it matters and one official link. Details live one tap deeper, never on Home.
3. **Mobile only.** Single column ≤ 430px, floating tab bar, 44px touch targets, light and dark
   (WCAG AA), works offline for content. Desktop shows the same column centered.
4. **No sign-up wall.** Profile lives on the device. Sign-in only adds sync.
5. **Official sources, always cited, always dated.** Every content item shows source links and
   "Last reviewed <date>". Persistent "Not legal advice" footer.
6. **Personal by status, not by account.** `visa → stage → dates → situations` drives everything.
7. **Dates never feel like homework.** Onboarding asks for at most two dates, both skippable.
   Month and year is enough wherever a day would not change the answer; an exact day is asked
   only for hard deadlines read off a document (I-94, I-797, EAD, program/OPT end). A missing
   date is asked for later, in context, one at a time, and a dismissed ask stays dismissed.
   When a month-only value is not enough (priority date in the cut-off's month) we say so and
   ask for the day instead of guessing.

## A6. Core experience: "Check now" (profile-driven checklist)

The **Check now** list (on the Today tab: the top check is the hero card, the rest are
"Also to check" rows, each opening a detail sheet; see A7) has 3–7 items ordered by urgency.
Each item reads like this card:

```
┌───────────────────────────────────────────────┐
│ Just entered the US                            │
│ Does your new I-94 show H-1B and the right     │
│ "Admit Until" date?                            │
│ Why: the I-94, not the visa stamp, controls    │
│ how long you can stay.                         │
│ [Get my I-94 (CBP) ↗]        [Yes ✓] [Not yet] │
└───────────────────────────────────────────────┘
```

- **Yes** marks it done (persisted). **Not yet** keeps it at the top and, where sensible,
  reveals the follow-up check (e.g. "Not yet" on "valid visa stamp?" reveals "Have you
  scheduled a consulate appointment?").
- Items come from three kinds of triggers:
  - **Situations** the user toggles from "Something changed?" on Today (active ones show as
    removable chips):
    *Just entered / returned to the US · Travelling soon · Changing employer · Laid off ·
    Graduating / program ending · Moved home*. Toggling a situation on re-opens its checks
    even if they were done before (each entry gets a fresh I-94 check).
  - **Dates** in the profile (extension window opened, EAD expiring, passport < 12 months,
    OPT application window open, I-983 evaluation due, kid turning 21).
  - **Calendar seasons** (H-1B registration season, new Visa Bulletin published).
- A "See all checks for H-1B" link opens the full list grouped by situation.

### A6.1 Check catalog (Phase 1 seed; each ships with the official link shown)

Common to all visas

| Trigger | Check (question) | Link |
|---|---|---|
| Entered / returned | Does your new I-94 show the right class and "Admit Until" date (D/S for F-1)? | CBP I-94: https://i94.cbp.dhs.gov |
| Entered / returned | Was your I-94 cut short to your passport expiry date? | same + content "I-94 shorter than I-797" |
| Entered (first time) | Have you applied for an SSN (H-1B, F-1 with job offer / OPT)? | SSA |
| Moved home | Did you file AR-11 within 10 days (and update every pending USCIS case)? F-1: tell your DSO / SEVP Portal | https://www.uscis.gov/addresschange |
| Passport < 12 months | Have you started your Indian passport renewal? Your next I-94 may be cut to passport expiry. | Indian Embassy / VFS **(verify current URL)** |
| Travelling soon | Is your US visa stamp valid on the day you return? If not: have you booked a consulate appointment? Where? **Since Sept 2025 you generally must apply in your country of nationality or residence (verify)** | https://www.ustraveldocs.com/in/ ; State Dept wait times |
| Travelling soon | Are you still eligible for interview waiver (dropbox)? Rules narrowed in Sept 2025 **(verify)** | State Dept interview-waiver page |
| Travelling soon | Have you set social-media accounts to public for the H-1B/H-4/F-1 online-presence review? **(verify, Dec 2025)** | State Dept notice |
| Travelling soon | Is your passport valid for the trip and re-entry? | — |
| Travelling soon | Do you have a pending I-539 / I-485 (without AP) that travel would abandon? | USCIS |
| Always | Do you have a USCIS online account and copies of every I-797 and I-94? | https://my.uscis.gov |
| Always | Scam check: USCIS never phones asking for payment or gift cards. | USCIS "Avoid scams" |

H-1B

| Trigger | Check | Link |
|---|---|---|
| Entered | Does the I-94 "Admit Until" match your I-797 end date (+10 days)? | CBP I-94 |
| I-797 expiring ≤ 6 months | Has your employer started the extension? It can be filed up to 6 months before expiry. | USCIS I-129 |
| Extension pending past I-797 expiry | Are you within the 240-day rule (timely filed = keep working)? Is your H-4 family's I-539 filed too? | 8 CFR 274a.12(b)(20) |
| Changing employer | Has the new employer **filed** the petition before your start date? You may start on the USCIS receipt (portability). | USCIS H-1B portability |
| Changing employer | Is your I-140 approved ≥ 180 days (priority date stays with you)? | 8 CFR 204.5(e) |
| Changing employer (I-485 pending ≥180 days) | Same or similar occupation? File Supplement J. | USCIS I-485 Supp J |
| Laid off | Count your 60-day grace from the last day of employment, not last pay. Options: new petition, change of status (B-2/F-1/H-4), depart. | USCIS "Options for nonimmigrant workers following termination" |
| Laid off | Did the employer offer return transportation (required)? Health insurance / COBRA? | DOL |
| 6-year clock within 12 months | Do you qualify for an extension beyond 6 years (I-140 approved and PD not current → 3 years; PERM/I-140 pending ≥ 365 days → 1 year)? Have you recaptured time spent outside the US? | AC21 §104(c), §106(a) |
| New rule alerts | Does the $100,000 H-1B proclamation apply to you (new petitions for people outside the US; not extensions/COS) **(verify)** | USCIS guidance |
| Spouse on H-4 | Is your spouse eligible for H-4 EAD (your I-140 approved)? | USCIS H-4 EAD |
| Kid ≥ 20 | Have you checked CSPA age / change to F-1 before 21? | USCIS CSPA |

Green card (H-1B / H-4 with a priority date)

| Trigger | Check | Link |
|---|---|---|
| PERM stage | Do you know your PERM filing date? (That becomes your priority date.) | DOL FLAG |
| I-140 approved | Is the priority date on the I-797 the one you expect (and for the right category)? | USCIS |
| New bulletin (monthly) | Is your PD current under **Dates for Filing**? Which chart is USCIS using this month? | Visa Bulletin; USCIS filing charts |
| PD within 12 months of Dates for Filing | Are I-485 documents ready: birth certificate (+ non-availability if needed), marriage certificate, photos, civil-surgeon medical (I-693 rules **verify**), I-94 history, employer letter? | USCIS I-485 checklist |
| EB-2 with EB-3 ahead | Have you discussed an EB-3 downgrade / interfiling with your employer or counsel? (informational) | USCIS interfiling policy |
| I-485 pending | Biometrics done? EAD/AP card received? Renew EAD 180 days before expiry. | USCIS I-765 / I-131 |
| I-485 pending | Travelling? Use AP or a valid H-1B stamp; never leave without one. | USCIS |
| I-485 pending ≥ 180 days | Changing jobs? Supplement J for a same-or-similar role. | USCIS |

H-4

| Trigger | Check | Link |
|---|---|---|
| Entered | Does your I-94 match the primary's dates? | CBP I-94 |
| Primary extension filed | Was your I-539 (and kids') filed with the I-129? | USCIS I-539 |
| Primary's I-140 approved | You are now eligible for H-4 EAD (I-765, category (c)(26)). Applied? | USCIS H-4 EAD |
| H-4 EAD expiring ≤ 6 months | Renewal filed? Automatic-extension rules changed Oct 2025 **(verify)**; plan for a work gap. | USCIS |
| No EAD | Not working, not freelancing, not day-trading for income? (status violation) | — |
| No SSN | Need an ITIN for taxes? | IRS W-7 |
| Kid ≥ 20 | Plan for aging out at 21 (F-1 change of status, CSPA if I-485 filed). | USCIS |

F-1 / OPT / STEM OPT

| Trigger | Check | Link |
|---|---|---|
| Entered | I-94 shows F-1 "D/S"? (Watch the proposed fixed-period rule **verify**.) | CBP I-94 |
| Enrolled | Full course load this term? Any CPT written on your I-20 before you started work? On-campus ≤ 20 h/week? | Study in the States |
| Travelling soon | I-20 travel signature < 12 months (< 6 months on OPT)? EAD card + job letter if on OPT? | SEVP |
| Program end within 90 days | OPT window is open: DSO recommendation → file I-765 within 30 days, and before 60 days after program end. | USCIS OPT |
| OPT EAD received | Did you create your SEVP Portal account? Report employer within 10 days. | https://sevp.ice.gov/opt/ |
| On OPT | Unemployment days used (max 90). Each job ≥ 20 h/week and related to your degree? | SEVP |
| OPT EAD expiring ≤ 90 days | STEM OPT eligible (CIP on STEM list, E-Verify employer)? I-983 signed? File before EAD expires (180-day auto-extension if timely). | USCIS STEM OPT |
| On STEM OPT | 12-month evaluation due on <date>; 6-month validation report due <date>; final evaluation at end. | SEVP I-983 |
| Changed employer on STEM OPT | New I-983 to DSO within 10 days? New employer E-Verify? | SEVP |
| Lottery season (Feb–Mar) | Is your employer registering you? Wage level now weights your odds (Level IV = 4 entries) **(final rule Dec 2025, verify current status)** | USCIS H-1B cap season |
| Selected | Petition filed between Apr 1 and Jun 30? Change of status or consular? Cap-gap keeps you working (through Apr 1 next year under the 2025 rule, verify). | USCIS cap-gap |
| OPT / STEM ending ≤ 60 days | Grace period ends <date>. Options: new program (SEVIS transfer), H-4, depart. | SEVP |

## A7. Screens

1. **Onboarding (3 steps, all skippable):** visa → stage (plain-language options) → at most two
   quick dates for that stage (`quick` in `visas.json`, e.g. I-94 "Admit until", or category +
   priority date), with "Skip for now" as prominent as the main button. A stage with nothing
   to ask goes straight to Today. Done in under 30 seconds.
2. **Today** (route `/home`): header with a visa · stage chip; "Something changed?" opens the
   situation sheet; **hero card** "Do this next" with the top open check (headline, one
   supporting line, "Yes, done" / "Not yet"); up to two **fact tiles**: nearest deadline, and
   for H-1B/H-4 with a priority date the **priority date tile** (your date, category, progress
   bar, "Not current yet" / "Current for filing"; tap for the detail view with both charts, the
   gap in years and months, movement, 12-month sparkline and the crude estimate), for F-1
   unemployment days left; **Also to check** rows (one-line headline) opening a bottom sheet
   (situation chip, headline, long question, why it matters, official links, Yes/Not yet,
   "Reviewed <date> · <source>"); **Done · N**; at most one quiet "add this date" prompt;
   up to 2 **Policy alerts** (with the Policy feed). Empty state: "You're all caught up".
3. **Journey:** a stepper (one dot per stage), "Stage N of M" and "X of Y steps done"; the
   stage's steps as one-line rows (tap the circle to mark done, tap the row to expand what /
   when / forms & fees / sources inline); a dashed "Next: <stage>" preview; group steps such as
   "Life events" below. Stage transitions prompt profile updates ("I-485 filed? Update your stage").
4. **Policy:** list filtered to the user's tags with chips (H-1B · H-4 · F-1/OPT · Green card ·
   Travel); each item shows type (Bill / Proposed rule / Final rule / Executive action), status
   chip, date, source link; curated items add "What it means for you".
5. **Me:** profile summary (change visa/stage); **Your dates** grouped Documents / Green card /
   Work permit as list rows (value or "Add"; a sheet with month-year or date control and
   "Clear"); **Advanced** (day counts, family flags); sign in with Google or email code; sync
   status; "Add my dates to calendar" (.ics); delete my data; about, sources, disclaimer.

## A8. Personalization model

Profile (device-local; synced when signed in; see TDD for schema):
`visa`, `stage`, `dates{…}`, `flags{spouseOnH4, kidsUnder21, kidBirthYear}`, `situations[]`,
`checks{id → {done, at}}`. Tags derived for policy: `H1B`, `H4`, `F1`, `OPT`, `GC`, `TRAVEL`.

Stages per visa (ids used by content):
- H-1B: `new` · `working` · `gc_perm_i140` · `gc_waiting_pd` · `i485_pending` · `approved`
- H-4: `no_ead` · `ead_eligible` · `ead_working` · `i485_derivative`
- F-1: `enrolled` · `opt_applying` · `opt` · `stem_opt` · `h1b_selected` · `ending`

### A8.1 Date precision

Declared per field in `web/content/visas.json`. Stored as `YYYY-MM-DD` (day) or `YYYY-MM` (month),
resolved to a full date once (`resolveDates`) using the field's `assume`, always the conservative side.

| Precision | Fields | Assumes |
|---|---|---|
| day (native date) | I-94 admit-until, I-797 end, EAD expiry, advance parole expiry, program end, OPT end, STEM OPT end | n/a |
| month | passport expiry, visa stamp expiry, first month in H-1B, last I-20 travel signature | start (warn earlier) |
| month | priority date, I-140 approved, spouse's I-140 approved, I-485 filed | end (never claim "current" or 180 days early) |

OPT and STEM OPT start are derived from the end date (12 and 24 months). Day counts are numbers
under Advanced in Me and never asked in onboarding.

## A9. User journeys (stage content; checks above are the "do now" layer)

**H-1B.** New on H-1B (I-797 vs I-94, stamping, LCA rights, maintaining status, 60-day grace) →
Working (extensions & 6-year clock with recapture, amendments, portability, layoff, H-4 family,
travel & stamping incl. consulate rules for Indians and the end of routine third-country
stamping **verify**) → Green card started (PERM → I-140, EB-2 vs EB-3, PD retention, extensions
beyond 6 years, H-4 EAD unlock) → Waiting for PD (bulletin explainer, which chart, movement
history and estimate, downgrade/interfiling, EB-1/NIW alternatives, CSPA, I-485 prep) → I-485
pending (EAD/AP, RFEs, interview, Supplement J, travel) → Approved (I-551, naturalization clock;
prompt to Phase 2 "LPR" journey).

**H-4.** Dependent basics (status tied to primary, I-539 with primary, no work, ITIN, study,
travel with pending I-539) → EAD eligible (I-765 (c)(26), validity tied to I-94, concurrent
filing, auto-extension changes **verify**) → Working on EAD (renewal 180 days out, gap risk,
switching to own status) → Derivative I-485 (own EAD/AP, aging-out kids). Life events as
content: child turning 21, primary laid off, divorce/death of primary (links only).

**F-1.** Enrolled (course load, CPT, I-20 end, travel signature, 5-month rule, grace, proposed
fixed-period rule **verify**) → Applying for OPT (window, DSO → I-765, premium option, no work
before EAD start, SEVP Portal) → On OPT (unemployment counter, lottery season, cap-gap, STEM
eligibility and timing) → STEM OPT (24 months, 150 days, I-983 evaluations, validation reports,
employer change, H-1B attempts, alternatives) → Selected (I-129 window, COS vs consular,
cap-gap, "switch my profile to H-1B") → Ending (grace, options).

## A10. Policy feed requirements

- Sources: **Congress.gov API v3** (bills, current Congress) and **Federal Register API**
  (rules, proposed rules, notices, presidential documents from DHS, USCIS, DOL, State).
- Only items tagged to the user's visa appear. Curated watchlist items carry a hand-written
  "what it means for you" (≤ 80 words) and are pinned above auto-ingested ones.
- Status chips: bills → Introduced · Passed House · Passed Senate · To President · Law;
  rules → Proposed (comment deadline) · Final (effective date) · In effect; presidential →
  Proclamation / Executive order (date).
- Seed watchlist (look up current bill numbers for the 119th Congress at build time):
  per-country-cap bills (EAGLE Act / Fairness for High-Skilled Immigrants), H-1B and L-1 Visa
  Reform Act, American Tech Workforce Act, Keep STEM Talent Act, America's CHILDREN Act, Dignity
  Act. Seed rules/actions: H-1B Modernization final rule (eff. Jan 17 2025); Proclamation on
  H-1B entry/$100k payment (Sept 19 2025) + USCIS guidance; **Weighted Selection final rule
  (published Dec 29 2025, effective Feb 27 2026, used for FY2027 registration Mar 4–19 2026)**;
  DHS proposed rule ending "duration of status" for F/J (Aug 2025, check for final); DHS
  interim final rule removing automatic EAD extensions (Oct 30 2025); State Dept interview-waiver
  narrowing (Sept 2 2025) and apply-in-country-of-nationality policy (Sept 6 2025); State Dept
  online-presence review for H-1B/H-4 (Dec 15 2025). All **verify** against the primary source
  before publishing.
- Refresh: daily. Each item shows "Updated <date>" and links to the primary source.

## A11. Accounts

| | Anonymous | Signed in (Google or email one-time code) |
|---|---|---|
| Checklist, journey, PD card, policy feed | ✓ | ✓ |
| Profile persistence | this device | all devices (last-write-wins) |
| Checklist done-state | this device | synced |
| Delete my data | clear device | DELETE account + device |
| Email alerts (PD current, new matching rule) | — | Phase 1b |

## A12. Content rules

- Every step/check has ≥ 1 primary source URL (uscis.gov, cbp.dhs.gov, ice.gov,
  studyinthestates.dhs.gov, travel.state.gov, dol.gov, federalregister.gov, congress.gov,
  ecfr.gov) and `lastReviewed`. Build fails without them.
- Time-sensitive facts carry `verify: true` until checked against the source during content
  writing; such items show a "Rules changed recently, confirm with the source" badge.
- Plain English, second person, one idea per sentence. No "should consult an attorney" on
  every line; one global disclaimer plus inline "talk to counsel" only where a decision is
  strategic (downgrade, interfiling, COS after layoff).

## A13. Success metrics (Phase 1)

- Onboarding completion ≥ 70%; median time to first "Check now" list < 60 s.
- ≥ 3 checks marked done per active user per month.
- Returning users within 30 days ≥ 40% (PWA install prompt accepted ≥ 15%).
- Zero content items older than 90 days without re-review.
- No PII stored beyond email for signed-in users.

## A14. Risks

- **Rule churn.** Phase 1 content must be verified on write, and the policy feed is the early-
  warning system. Mitigation: `verify` flags, "last reviewed" badges, monthly review ritual.
- **Visa Bulletin parsing** breaks when the State Dept changes HTML. Mitigation: hand-editable
  JSON is the source of truth; the script is a convenience.
- **Congress.gov has no keyword search.** Mitigation: pull bills updated since last run and
  filter titles locally, plus the curated watchlist.
- **Email sign-in UX.** Cognito email one-time code is not a click-through magic link.
  Accepted for Phase 1.
- **Trust.** Not a law firm. Mitigation: cite everything, store almost nothing.

