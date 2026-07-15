# Fitzen Architecture

## Design goals

1. **Trustworthy numbers** — every metric carries uncertainty; every record is
   tamper-evident; the server is the verification authority.
2. **Works on a village pitch** — offline-first capture and reads; on-device
   inference; low-end-device budgets (no heavy UI frameworks, code-split routes,
   lazy model loading).
3. **One domain codebase** — all physics/crypto/scoring lives in `@fitzen/engines`
   with zero I/O and zero framework imports, so the client, the server, and the test
   suite run the *same* logic (and the Flutter port maps 1:1).

## System overview

```
┌─────────────────────────── Browser (React + Vite) ───────────────────────────┐
│  pages/ ── components/ ── state (auth/theme/toast/sync contexts)             │
│     │                                                                        │
│  pose sources                engines (WASM-free TS)         lib/             │
│  ┌───────────────┐   frames  ┌──────────────────────┐       ┌─────────────┐  │
│  │ CameraPose    │──────────▶│ analyzeJump          │ sign  │ deviceKeys  │  │
│  │ (MediaPipe)   │           │  · flight-time fit   │──────▶│ (ECDSA IDB) │  │
│  │ SimulationPose│           │  · displacement est. │       └──────┬──────┘  │
│  └───────────────┘           │  · fusion + 95% CI   │              │ envelope│
│                              └──────────────────────┘              ▼         │
│                                              IndexedDB outbox ── sync engine │
└───────────────────────────────────────────────────────┬──────────────────────┘
                                        POST /api/sync   │  (idempotent, batched)
┌───────────────────────────── Node API (no framework) ──▼──────────────────────┐
│ router → auth middleware → services                                           │
│   assessmentService: parse envelope → detectTampering (signature + hash chain │
│   + plausibility) → integrity verdict → SQLite (node:sqlite, WAL)             │
│   statsService: aggregates, badges, leaderboard, potential (engines)          │
│   aiService: Claude brief (claude-opus-4-8) with deterministic fallback       │
└───────────────────────────────────────────────────────────────────────────────┘
```

## The measurement problem (module 1)

A phone camera gives normalized 2-D landmarks at an uneven ~30 fps. Naïve
threshold-crossing on ankle position clips the ballistic arc (the ankle must travel a
finite distance before crossing any threshold), biasing flight time low by 2+ frames.

Fitzen's estimator instead:

1. Brackets the airborne window with ankle-threshold crossings (robust but biased).
2. Fits `y(t) = at² + bt + c` to the airborne **hip** trajectory by least squares —
   the centre of mass is ballistic in flight, so this recovers the true parabola.
3. Solves analytically for the two baseline crossings → an unbiased, inherently
   sub-frame flight time `T`, then `h = gT²/8`.
4. Independently estimates height from hip displacement scaled by the athlete's
   stated stature (nose→ankle span ≈ 93% of standing height).
5. Fuses both by inverse-variance weighting. Error budget: uniform frame-interval
   quantization at each edge (σ = Δt/√6, halved by interpolation) propagated through
   ∂h/∂T = gT/4; landmark jitter + scale error for the displacement path.

The reported 95% CI is honest: in tests, ground truth from the physics simulator falls
inside the CI, and lower capture fps provably widens σ.

**Simulation as a first-class citizen.** `simulateJump()` synthesizes landmark
sequences from the same ballistic model (standing → sinusoidal dip → drive → flight →
absorption), with seeded noise and controllable asymmetry. It powers the engine tests,
the seed data, and the app's Guided Demo — meaning the *entire* product can be
demonstrated and regression-tested without a camera.

## Integrity model (module 2)

- **Canonicalization** — stable JSON (sorted keys, no whitespace) so hashes are
  reproducible across JS engines.
- **Device identity** — each browser generates an ECDSA P-256 keypair persisted in
  IndexedDB; its fingerprint (SHA-256 of the canonical public JWK) travels with every
  record and appears in Settings for auditability.
- **Signing** — signature over the canonical payload bytes; payload hash stored
  alongside for chain reference.
- **Audit trail** — append-only entries (`captured`/`analyzed`/`signed`/…), each
  hashing `prevHash + body`; any edit, reorder, or deletion breaks the chain at a
  identifiable index.
- **Tamper detection** — server-side `detectTampering` combines: hash recomputation,
  signature verification, chain verification, and *physical plausibility*: bounds on
  height/flight/power **plus cross-consistency** (`h ≈ gT²/8` must roughly hold), so an
  attacker with a valid key still can't submit a fabricated 1.2 m jump.
- **Authority** — integrity is decided at ingest on the server and re-checkable on
  demand (`POST /api/assessments/:id/verify`). Tampered records are kept (evidence)
  but excluded from stats, badges, potential, and leaderboards.

## Potential scoring (module 3)

Deliberately a transparent weighted model rather than a black box: talent-ID decisions
need explanations. Sub-scores (explosiveness, power, movement quality, coordination,
consistency, anthropometrics) are z-scored against age/sex reference norms and mapped
through a logistic to 0–100. Biological maturity uses a Mirwald-style
years-from-PHV estimate (chronological age vs sex-specific PHV age, height-for-age
adjustment, optional mid-parental target height); pre-PHV athletes gain potential
headroom gated by movement quality ("raw athletes with poor mechanics realize less of
their ceiling") while confidence shrinks with distance from PHV, small sample counts,
and high run-to-run variability. Every insight carries a signed point contribution.

## Offline-first sync

Writes: sign → IndexedDB outbox → optimistic flush → server `POST /api/sync` (batch,
max 100). The server upserts on `(athleteId, clientId)` so retries and duplicate
flushes are harmless; per-item results let the client clear exactly what landed.
Validation failures are dropped from the queue (they can never succeed) — network
failures are retained. Reads: dashboard/history/leaderboard cache their last server
snapshot in IndexedDB and serve it with an "offline" chip when fetches fail.

## Why no Express / ORM / UI kit

- `node:http` + a 120-line typed router covers the API surface; `node:sqlite` ships
  with Node 22.5+; scrypt/HMAC/WebCrypto are built-ins. Zero native modules means
  `npm install` works on any machine and the attack surface is tiny.
- The design brief demanded a custom system anyway; hand-rolled SVG charts are ~200
  lines, themed by CSS variables, and cost 0 KB of dependencies. Total client JS is
  ~178 KB (58 KB gzip) plus a lazily-loaded MediaPipe chunk on the assess route only.

## Flutter path

`@fitzen/engines` is the porting contract: no DOM, no Node APIs (WebCrypto is the one
platform call, isolated in `assessmentCrypto.ts` → maps to `pointycastle`/`cryptography`
in Dart). The API server is client-agnostic. The Flutter app reuses the REST contract
(`docs/API.md`), reimplements the engines file-for-file, and swaps MediaPipe
tasks-vision for the MediaPipe Android/iOS task API.
