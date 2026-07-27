# Fitzen — AI Motion Intelligence & Sports Talent Assessment Platform
## Master Technical Specification & Architecture Documentation

---

## 📌 Executive Summary

**Fitzen** is a state-of-the-art, high-precision remote AI sports talent identification, motion analysis, and performance verification platform. Built on deterministic 3D pose kinematics, finite state machine (FSM) fraud detection, and asymmetric WebCrypto ECDSA P-256 digital signatures, Fitzen enables remote athletes to submit verifiable athletic assessments (Vertical Jump, Push-Ups, Squats) using standard smartphone or laptop webcams without physical jump mats or expensive laboratory hardware.

Every assessment executed on Fitzen undergoes real-time computer vision analysis, temporal smoothing, biomechanical validity checks, anti-cheat detection, and cryptographic signing, producing an immutable, verifiable digital resume for talent scouts, coaches, and sports academies worldwide.

---

## 🔬 Research Foundation & Scientific Rigor

Fitzen implements the core mathematical and biomechanical models outlined in the *Fitzen Motion Intelligence Research Seminar*:

### 1. 3D Vector Geometry & Joint Kinematics
Joint angles (Elbows, Knees, Hips) are calculated in 3D Euclidean space using spatial landmark coordinates $A(x_A, y_A, z_A)$, $B(x_B, y_B, z_B)$, and $C(x_C, y_C, z_C)$:

$$\vec{BA} = (x_A - x_B, y_A - y_B, z_A - z_B)$$
$$\vec{BC} = (x_C - x_B, y_C - y_B, z_C - z_B)$$

The 3D interior joint angle $\theta_{ABC}$ is computed via spatial dot product:

$$\theta_{ABC} = \arccos\left(\frac{\vec{BA} \cdot \vec{BC}}{\|\vec{BA}\| \|\vec{BC}\|}\right)$$

### 2. 5-Point Savitzky-Golay Temporal Filter
To eliminate high-frequency camera jitter and landmark prediction noise, landmark sequences are smoothed using a 5-point quadratic Savitzky-Golay polynomial filter:

$$\hat{y}[k] = \frac{1}{35} \left( -3 y[k-2] + 12 y[k-1] + 17 y[k] + 12 y[k+1] - 3 y[k+2] \right)$$

### 3. Flight-Time Kinematic Jump Height & Power
Vertical jump height $h$ is computed from aerial flight time $t_{\text{flight}}$:

$$h = \frac{g \cdot t_{\text{flight}}^2}{8} \quad \text{where } g = 9.80665 \, \text{m/s}^2$$

Peak relative power ($W/\text{kg}$) is calculated using the Sayers Equation:

$$P_{\text{peak}} = 60.7 \cdot (\text{Jump Height cm}) + 45.3 \cdot (\text{Body Mass kg}) - 2055$$

### 4. Deterministic FSM Anti-Cheat & Fraud Engine
Repetitive movement assessments follow a strict 4-state deterministic Finite State Machine:

```
 [INIT] ---> [UP] ---> [DOWN] ---> [VALID_REP] ---> [UP]
               |          |
               +---(Incomplete Depth / Asymmetry)---> [REJECTED_REP]
```

- **Depth Threshold Enforcement**: Push-Ups require elbow flexion $\le 90^\circ$; Squats require knee flexion $\le 95^\circ$.
- **Bilateral Symmetry Enforcement**: Left vs Right limb asymmetry must satisfy $|\theta_{\text{left}} - \theta_{\text{right}}| \le 15^\circ$.
- **Half-Rep Rejection**: Attempting to reverse movement before reaching full depth immediately flags `HALF_REP_INCOMPLETE_ROM` and invalidates the repetition.

### 5. Biological Maturity & Potential Scoring
Applies the Mirwald Maturity Offset equation to evaluate an athlete's biological age vs chronological age, estimating athletic talent headroom across Explosiveness, Power, Coordination, and Movement Quality.

---

## 🛠️ Complete Technology Stack

Fitzen is structured as a modular TypeScript monorepo (`npm` workspaces):

```
fitzen/
├── apps/
│   ├── web/       # React 18, Vite, Vanilla CSS Design System, WebGL Canvas 3D
│   └── server/    # Node.js, SQLite (node:sqlite), WebCrypto, REST API
└── packages/
    └── engines/   # Pure TypeScript Kinematics, FSM, Analytics & Crypto Engines
```

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 + Vite | Lightning-fast HMR SPA with client routing |
| **Styling & Design System** | Vanilla CSS Tokens & HSL | Sleek cybernetic dark-mode UI with glassmorphism |
| **Computer Vision / Pose** | MediaPipe Pose & HTML5 Canvas | 33 3D landmark extraction & live overlay badges |
| **3D Graphics** | Custom WebGL / 2D Vector Mesh | 3D Cybernetic Holographic Human Muscle Model |
| **Offline Sync** | IndexedDB (`idb` library) | Offline-first assessment queuing and sync |
| **Backend Runtime** | Node.js (v24 native TS) | Lightweight, fast REST API |
| **Database** | SQLite (`node:sqlite`) | Zero-dependency native SQLite in WAL mode |
| **Cryptography** | WebCrypto ECDSA P-256 & SHA-256 | Asymmetric signing and canonical hash verification |
| **Unit Testing** | Vitest | 83+ comprehensive unit and integration tests |

---

## 🏋️ Multi-Assessment Suite

Fitzen supports 3 core athletic assessment disciplines:

### 1. 🚀 Vertical Jump Assessment
- **Metrics Tracked**: Countermovement depth (cm), flight time (s), jump height (cm), 95% confidence intervals, relative peak power (W/kg), landing symmetry, and movement quality score.
- **Visuals**: Real-time landing phase detection, force-time curve simulation, and confidence bands.

### 2. 💪 Push-Up Assessment
- **Metrics Tracked**: Valid repetitions, rejected half-reps, elbow joint angles ($\theta_{\text{left}}, \theta_{\text{right}}$), arm balance asymmetry ($^\circ$), and form accuracy %.
- **Visuals**: Real-time canvas badges drawing active elbow angles on camera stream.
- **Feedback**: "Points to Improve" (e.g. *"Lower chest until elbow flexion is $\le 90^\circ$"*).

### 3. 🏋️ Squat Assessment
- **Metrics Tracked**: Valid repetitions, shallow depth rejections, knee joint angles ($\theta_{\text{left}}, \theta_{\text{right}}$), lateral knee valgus tracking, and form accuracy %.
- **Visuals**: Real-time canvas badges drawing active knee angles on camera stream.
- **Feedback**: "Points to Improve" (e.g. *"Achieve full parallel knee depth $\le 95^\circ$"*).

---

## 🦾 Cybernetic 3D Holographic Human Model

Integrated into the **Athlete Dashboard Hero Section**, the 3D Holographic Human Model features:

- **Organic Athletic Silhouette**: Smooth organic Bezier body contours with rounded deltoids, V-tapered waist, and distinctly separated curved legs.
- **Interactive Muscle Differentiation**:
  - 🦾 **Pectoralis Major & Triceps** (Push-Ups press)
  - 🏋️ **Quadriceps Femoris** (Squats depth & takeoff drive)
  - 🦵 **Gluteus Maximus & Hamstrings** (Countermovement jump hip hinge)
  - ⚡ **Gastrocnemius & Soleus (Calves)** (Ankle stiffness & flight time)
  - 🛡️ **Rectus Abdominis (Core)** (Pelvic stability)
  - 🏹 **Deltoids & Trapezius** (Overhead reach)
- **Interactive Hover HUD Diagnostics**: Hovering over any muscle group displays its anatomical target, score, **📍 Where to Improve**, **💡 How to Improve**, and **⚡ Recommended Form Drills**.

---

## 🏆 50-Badge Gamification & Global Leaderboard

### 50-Badge Achievement Trophy Room
Divided into 6 athletic categories:
1. **Vertical Jump** (10 badges: *First Flight*, *Half-Metre Club*, *Sky Walker*, *Moon Leap*, etc.)
2. **Push-Up Mastery** (10 badges: *Push-Up Rookie*, *Push-Up Warrior*, *Push-Up Titan*, *Hercules Press*, etc.)
3. **Squat Mastery** (10 badges: *Squat Starter*, *Squat Pioneer*, *Iron Legs*, *Olympic Depth*, etc.)
4. **Relative Power** (5 badges: *Spark*, *Dynamo*, *Power House*, *Supercharged*, etc.)
5. **Form & Quality** (5 badges: *Form Student*, *Perfectly Balanced*, *The Technician*, *Triple Threat*, etc.)
6. **Streaks & Milestones** (10 badges: *Dedicated*, *Century Club*, *On a Roll*, *Monthly Legend*, etc.)

### Multi-Metric Leaderboard
Allows global ranking filtered by:
- **🚀 Jump Height** (Ranked by best jump height in cm)
- **💪 Push-Up Reps** (Ranked by max valid push-ups)
- **🏋️ Squat Reps** (Ranked by max valid squats)
- **⚡ Peak Power** (Ranked by W/kg relative power)

---

## 🔐 Cryptography & Verifiable Digital Resumes

1. **Key Generation**: Upon first load, the browser generates an exportable WebCrypto ECDSA P-256 key pair.
2. **Canonical JSON Hashing**: Assessment metrics are stringified using deterministic key sorting and hashed with SHA-256.
3. **Digital Signature**: The device private key signs the canonical payload hash.
4. **Audit Trail**: Append-only log tracking capture time, FPS, device fingerprint, and analysis parameters.
5. **Verifiable Digital Resume Export**: Athletes can export a signed `.json` digital resume with one-click cryptographic verification for talent scouts.

---

## ⚡ Getting Started & Local Setup

### 1. Prerequisites
- Node.js v20+ or v24+
- npm v9+

### 2. Installation
```bash
git clone https://github.com/shivanjayb/Fitzen-AI-Sports-Talent-Assessment.git
cd Fitzen-AI-Sports-Talent-Assessment
npm install
```

### 3. Run Application locally
```bash
npm run dev
```
- **Web App**: `http://localhost:5174/`
- **Backend API**: `http://localhost:4000/`

### 4. Run Test Suite
```bash
npm test
```
Runs all 83 Vitest unit and integration tests across `@fitzen/engines`, `@fitzen/server`, and `@fitzen/web`.

---

## 🔮 Future Roadmap

1. **Mobile Native App & WebRTC Streaming**: Native iOS/Android camera capture with low-latency WebRTC live coach streaming.
2. **Multi-Camera 3D Pose Triangulation**: Support dual-angle smartphone camera setups for sub-millimeter 3D spatial joint tracking.
3. **AI LLM Performance Agent**: Deep integration with Anthropic Claude API for individualized weekly training regime synthesis.
4. **Wearable Sensor Fusion**: Sync IMU accelerometer data from Apple Watch / WHOOP for ground reaction force validation.
