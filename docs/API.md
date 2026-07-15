# Fitzen REST API

Base URL: `http://localhost:4000`. All bodies are JSON. Authenticated routes take
`Authorization: Bearer <jwt>`. Errors: `{ "error": string }` with 400/401/403/404/409/413/500.

## Auth

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | `{email, password, name, role?}` | `role` ∈ `athlete` (default) \| `coach`. Returns `{user, token}` (201). |
| POST | `/api/auth/login` | `{email, password}` | Returns `{user, token}`. Uniform 401 on bad email *or* password. |

## Current user

| Method | Path | Notes |
|---|---|---|
| GET | `/api/me` | `{user, profile}` |
| PUT | `/api/me/profile` | `{sex, birthDate, heightCm, massKg, midParentalHeightCm?, sport?, region?, coachId?}` |
| GET/PUT | `/api/me/settings` | `{theme, units, notificationsEnabled, leaderboardOptIn}` |

## Assessments

The upload unit is a **signed envelope**:

```jsonc
{
  "signed": {
    "payload": {
      "clientId": "uuid",            // offline id → idempotency key
      "athleteId": "usr_…",          // must match the authenticated athlete
      "test": "vertical_jump",
      "capturedAt": "ISO-8601",
      "metrics": { "jumpHeightM": 0.45, "jumpHeightCiLow": …, "jumpHeightCiHigh": …,
                   "flightTimeS": …, "peakPowerW": …, "relativePowerWkg": …,
                   "symmetryScore": …, "movementQuality": …, "confidence": …,
                   "effectiveFps": …, "countermovementDepth": …, "qualityFlags": [] }
    },
    "payloadHash": "sha256-hex",
    "signature": "base64 ECDSA-P256-SHA256",
    "publicKeyJwk": { … }, "keyFingerprint": "hex16",
    "algorithm": "ECDSA-P256-SHA256", "signedAt": "ISO-8601"
  },
  "auditTrail": [ { "index": 0, "at": "…", "event": "captured", "details": {…},
                    "prevHash": "GENESIS", "entryHash": "sha256-hex" }, … ]
}
```

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/api/assessments` | athlete | Ingest one envelope. Server verifies signature + audit chain + plausibility → `integrity: verified\|tampered`. 201 created / 200 duplicate. Returns `{record, created, newBadges}`. |
| POST | `/api/sync` | athlete | `{assessments: envelope[]}` (≤100). Per-item results: `created\|duplicate\|error`. Idempotent by `clientId`. |
| GET | `/api/assessments` | any | Own records; coach/admin may pass `?athleteId=`. |
| GET | `/api/assessments/:id` | owner/coach/admin | Single record. |
| POST | `/api/assessments/:id/verify` | any | Re-runs full integrity evaluation, updates stored verdict. |

## Analytics & gamification

| Method | Path | Notes |
|---|---|---|
| GET | `/api/stats/me` | `{stats, potential}` — potential includes components + insights. |
| GET | `/api/badges/me` | All badges with `earned`, `progress`, `earnedAt`. |
| GET | `/api/leaderboard?metric=jump\|power&region=` | Verified results only; respects opt-out. |
| GET | `/api/ai/brief[?athleteId=]` | Coaching brief; `source: "claude"\|"deterministic"`. |

## Notifications

`GET /api/notifications` · `POST /api/notifications/read-all` · `POST /api/notifications/:id/read`

## Coach & admin

| Method | Path | Role |
|---|---|---|
| GET | `/api/coach/roster` | coach/admin — assigned athletes with stats. |
| GET | `/api/coach/athletes/:id` | coach/admin — full summary (profile, stats, potential, assessments, badges). |
| GET | `/api/admin/users?role=` | admin |
| GET | `/api/admin/overview` | admin — platform counters incl. tampered count. |

`GET /api/health` → `{status:"ok"}` (no auth).
