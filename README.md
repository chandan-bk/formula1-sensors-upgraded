# Formula 1 Rules & Motorsport IoT Sensors Explorer (Upgraded)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/chandan-bk/formula1-sensors-upgraded)

An interactive, explodable 3D Formula 1 digital twin built with **Three.js** and **Vite**, demonstrating the **2026 FIA Formula 1 Technical Regulations** and **32 Real-Time Motorsport IoT Telemetry Sensors** with an integrated fault-injection and diagnostic simulation engine.

👉 **Live Demo**: [https://chandan-bk.github.io/formula1-sensors-upgraded/](https://chandan-bk.github.io/formula1-sensors-upgraded/)

---

## 1. Quick Start

### Prerequisites
- Node.js (LTS version recommended: v18+)
- Modern web browser with WebGL hardware acceleration enabled

### Installation & Execution

```bash
# Clone the repository
git clone https://github.com/chandan-bk/formula1-sensors-upgraded.git
cd formula1-sensors-upgraded

# Install dependencies
npm install

# Start development server (http://localhost:5173/)
npm run dev

# Run automated unit test suite (602 automated assertions)
npm test

# Run browser E2E automated test runner (Headless Chrome/Edge with screenshots)
npm run test:e2e

# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 2. Architecture & Rendering Pipeline

The application is structured into decoupled, modular systems:

```
src/
├── car/                     # Procedural 3D Car Model & Sensors Hardware
│   ├── aero.js              # Front & rear active-aero wings, flaps, DRS linkages
│   ├── body.js              # Chassis floor, sidepods, engine cover, nosecone
│   ├── build.js             # Master assembly coordinator & registry linking
│   ├── cockpit.js           # Halo, driver model, steering wheel, pedal box
│   ├── corners.js           # Brake assemblies, uprights, suspension wishbones, wheels
│   ├── dims.js              # 2026 FIA regulatory reference dimensions
│   ├── geometry.js          # Lofted aerodynamic surfaces & compound curves
│   ├── internals.js         # ICE block, 350 kW MGU-K, battery energy store, radiators
│   ├── materials.js         # Physically-based rendering (PBR) carbon, titanium, rubber
│   ├── registry.js          # Part lookup, explode vector transforms, bounding boxes
│   └── sensors.js           # 3D procedural IoT sensor hardware, halos & signal links
├── config/
│   └── sensorsConfig.js     # Feature flags (ENABLE_SENSORS, DEBUG_SENSORS)
├── data/
│   ├── parts.js             # FIA 2026 regulatory component classifications (LTC, OSC, SSC, PDC, TRC)
│   ├── sensorDetails.js     # Physics principles, specs grids, and investigation checklists
│   ├── sensors.js           # Master catalogue of 32 motorsport telemetry channels
│   └── telemetry.js         # Physically coupled 30 Hz lap simulator & fault engine
├── dimensions.js            # Interactive FIA regulatory measurement callouts
├── studio.js                # Three.js floor shadows, contact occlusion, and studio lighting
├── main.js                  # Main render loop, post-processing composer, and event coordinator
├── style.css                # Motorsport-inspired dark theme UI styling
└── ui/
    ├── callout.js           # Dynamic floating pinned card, SVG leader line, 3 technical tabs
    ├── liveScope.js         # Real-time HTML5 Canvas oscilloscope with threshold limit lines
    ├── panels.js            # Top bar presets, explode slider, layer checkboxes, X-ray mode
    ├── sensorPreview.js     # 360-degree turntable inspector modal
    └── sensorsUI.js         # Floating sensor network HUD, mini track map, search & tour
```

### Rendering & Performance Optimization
- **Demand Rendering (`requestRender`)**: Draws frames only when camera orbits, animations tween, or UI state changes, eliminating idle GPU consumption.
- **PBR Materials & GTAOPass**: Ground-Truth Ambient Occlusion grounds the car on the floor, while PCF soft shadow maps update only during geometry transforms.
- **Memory Management**: Geometry and texture singletons are cached and reused across marker instancing. Dynamic previews in the 360° inspector feature clean unmount routines to prevent WebGL context leaks.

---

## 3. Sensor Catalogue (32 Telemetry Channels)

The catalogue covers 32 sensors grouped into 8 vehicle engineering subsystems:

| Subsystem | Sensor Name | Channel Key | Authority | Category | Sample Rate | Normal Range |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Wheels & Tyres** | Wheel Speed Sensor | `wheelSpeed` | Team | Control | 1,000 Hz | 0 – 290 rad/s |
| | Tyre Pressure (TPMS) | `tpms` | FIA | Monitoring | 10 Hz | 1.38 – 1.95 bar |
| | Tyre Surface IR Array | `tyreSurf` | Team | Instrumentation | 100 Hz | 75 – 122 °C |
| **Brakes & Suspension** | Carbon Brake Disc Pyrometer | `discTemp` | Team | Monitoring | 100 Hz | 350 – 850 °C |
| | Brake-by-Wire Hydraulic Pressure | `brakePress` | Team | Control | 1,000 Hz | 0 – 135 bar |
| | Pushrod Strain Load Cell | `pushrod` | Team | Instrumentation | 500 Hz | 2.0 – 12.5 kN |
| | Linear Damper Travel Potentiometer | `damper` | Team | Instrumentation | 1,000 Hz | 10 – 52 mm |
| | Dynamic Laser Ride Height | `rideHeight` | Team | Instrumentation | 500 Hz | 7.5 – 38 mm |
| | Steering Column Angle & Torque | `steer` | Team | Control | 1,000 Hz | –140° to +140° |
| **Aero & Airflow** | Nose Dynamic Pitot-Static Array | `airspeed` | Team | Instrumentation | 200 Hz | 0 – 360 km/h |
| | Active-Aero Flap Position LVDT | `aeroFlap` | FIA | Control | 1,000 Hz | 2° – 30° |
| | Rear Wing Pylon Strain Array | `wingStrain` | Team | Instrumentation | 500 Hz | 400 – 2,400 µε |
| | Ambient Air Temp & Baro Probe | `ambient` | FIA | Monitoring | 10 Hz | 18 – 42 °C |
| **Chassis & Safety** | Chassis 6-Axis IMU | `imu` | Team | Control | 1,000 Hz | –4.8 to +4.8 g |
| | FIA Accident Data Recorder (ADR) | `adrG` | FIA | Monitoring | 1,000 Hz | 0 – 8.0 g (impact) |
| | FIA GPS & Sector Timing Transponder | `lapDist` | FIA | Monitoring | 20 Hz | 0 – 5,120 m |
| **Driver & Cockpit** | Pedal Assembly Dual Potentiometer | `throttle` | Team | Control | 1,000 Hz | 0 – 100 % |
| | Driver Biometric Glove (PPG) | `heartRate` | FIA | Monitoring | 4 Hz | 85 – 188 bpm |
| | In-Ear 3-Axis Crash Accelerometer | `headG` | FIA | Monitoring | 1,000 Hz | 0 – 5.5 g |
| | FIA Marshalling Light Display | `flag` | FIA | Monitoring | 10 Hz | Green / Yellow / Red / SC |
| **Engine & Fuel** | Crankshaft & Camshaft RPM Hall | `rpm` | Team | Control | 20,000 Hz | 4,200 – 14,750 rpm |
| | FIA Ultrasonic Fuel Mass Flow Meter | `fuelFlow` | FIA | Monitoring | 100 Hz | 0 – 3,000 MJ/h |
| | Common-Rail Injection Pressure | `fuelPress` | Team | Control | 2,000 Hz | 200 – 505 bar |
| | Oil & Coolant Temperature Probes | `coolant` | Team | Monitoring | 20 Hz | 78 – 116 °C |
| | Exhaust Pyrometer & Wideband Lambda | `lambda` | Team | Control | 100 Hz | 0.88 – 1.18 λ |
| | Turbocharger Shaft Speed Sensor | `turbo` | Team | Monitoring | 10,000 Hz | 40 – 124 krpm |
| **Hybrid & Drivetrain** | MGU-K Resolver & Current Clamps | `mgukPower` | Team | Control | 10,000 Hz | –350 to +350 kW |
| | Battery BMS Cell Voltage Shunt | `soc` | FIA | Monitoring | 100 Hz | 8 – 96 % SoC |
| | Driveshaft Telemetry Torque Collar | `shaftTorque` | FIA | Instrumentation | 1,000 Hz | –600 to +4,250 Nm |
| | Gearbox Selector Barrel Sensor | `gear` | Team | Control | 1,000 Hz | 1 – 8 gears |
| **Electronics & Comms** | FIA Standard ECU (SECU TAG-320) | `canLoad` | FIA | Control | 1,000 Hz | 35 – 82 % load |
| | High-Bandwidth Telemetry Antenna | `rssi` | Team | Monitoring | 100 Hz | –84 to –40 dBm |

---

## 4. Telemetry Physics & Fault Simulation Engine

### Consistent Vehicle Physics Simulation
Telemetry is not randomly generated. All 32 channels evolve from an integrated 84-second simulated Grand Prix lap (`src/data/telemetry.js`):
- **Braking**: Throttle drops to 0%, brake pressure surges to 120+ bar, deceleration reaches –5.0g, kinetic energy regenerates into the battery via MGU-K (–350 kW), and carbon disc temperatures climb past 750 °C with progressive cooling on the subsequent straight.
- **Cornering**: Lateral g spikes up to 4.5+ g, suspension pushrod loads transfer across axles, and steering angle correlates with chassis yaw rate.
- **Active Aero**: Flaps shift between low-drag **Straight Mode** (>205 km/h on straights) and high-downforce **Corner Mode** under cornering and braking.

### Operational Sensor Fault Injection
The application features an interactive fault-injection suite allowing engineers and students to simulate real-world failure modes on any sensor:

1. **Disconnected (Open Circuit)**: Simulates pin pull-out or severed wiring loom. Signal drops immediately to zero rail (`OPEN_CKT`), 3D marker dims to slate gray, and scope trace flatlines at bottom.
2. **Stuck (Frozen ADC)**: Simulates frozen converter silicon or seized mechanical linkage. Value freezes indefinitely regardless of vehicle acceleration.
3. **High-Frequency EMI Noise**: Simulates high-voltage 900V MGU-K inverter switching noise coupling into unshielded analog signal lines. Induces erratic high-frequency voltage spikes.
4. **Out of Range (Saturation)**: Simulates bridge resistor short circuit to excitation rail, saturating the signal above 130% full-scale ceiling.
5. **Signal Latency (CAN Buffer Lag)**: Simulates CAN queue backlog, introducing ~3.0 seconds of latency between physical vehicle events and telemetry traces.
6. **Intermittent (Contact Bounce)**: Simulates road-vibration-induced terminal chatter, producing periodic signal dropouts.

Each fault displays an attention-grabbing alert banner explaining:
- Diagnostic Failure Code (`OPEN_CKT`, `ADC_FROZEN`, `EMI_NOISE`, `SATURATION`, `CAN_LAG`, `INTERMITTENT`)
- Root-cause hypothesis
- **Race Engineer Diagnostic Action Checklist** guiding students through physical troubleshooting
- One-click **"Restore Channel to Nominal"** recovery button.

---

## 5. End-to-End 6-Stage Telemetry Architecture

The data path tab visualizes the complete signal flow from track to mission control:

```
[ Stage 1: Sensing Element ] ➔ Physical transducer or virtual state observer
            ▼
[ Stage 2: Signal Conditioning ] ➔ Differential amplification & 24-bit A/D conversion
            ▼
[ Stage 3: Vehicle Network ] ➔ High-speed deterministic CAN-FD & Automotive Ethernet
            ▼
[ Stage 4: Central Processing ] ➔ McLaren Applied TAG-320 SECU & solid-state ADR logger
            ▼
[ Stage 5: Wireless Transmission ] ➔ Encrypted microwave RF antenna (ATLAS telemetry bursts)
            ▼
[ Stage 6: Engineering Console ] ➔ Pit wall live oscilloscope traces & strategy analysis
```

---

## 6. Engineering & Regulatory Accuracy

1. **Anti-Lock Braking (ABS) & Traction Control (TC) Clarification**:
   Under FIA Formula 1 Technical Regulations (Articles 10 and 11), conventional ABS and traction control systems are **strictly illegal**. Wheel speed sensors are utilized exclusively for legitimate engineering calculations:
   - Wheel slip ratio estimation
   - Rear Brake-by-Wire friction versus MGU-K regen torque migration
   - Differential ramp preload scheduling
   - Launch clutch engagement control
   - FIA anti-cheat compliance auditing to prove the absence of banned traction control algorithms.
2. **Standard Electronic Control Unit (SECU)**:
   All Formula 1 cars must run the single-supplier **McLaren Applied TAG-320 SECU** running mandatory FIA-audited control software to ensure regulatory parity.
3. **Illustrative vs Real-World Data**:
   All telemetry traces, sample rates, and calibration thresholds represent realistic engineering approximations for academic and demonstration purposes. Official team calibrations and telemetry setups remain strictly confidential.

---

## 7. Quality Gates & Automated Verification

The repository incorporates automated quality assurance across two complementary test suites:

### 1. Data Integrity & Physics Unit Tests
```bash
npm run test:unit
```
Runs **602 automated assertions** validating:
- 32-sensor catalogue completeness and ID uniqueness
- 3D parent part binding and coordinate anchor placement
- Telemetry channel range consistency and threshold definitions
- Physical vehicle dynamics coupling and step integration
- Full lifecycle of all 6 fault injection modes and channel recovery.

### 2. Browser E2E Integration Tests (CDP Automation)
```bash
npm run test:e2e
```
Launches Vite and headless Chrome/Edge via Chrome DevTools Protocol to verify 14 comprehensive Quality Gates:
- Application initialization & 3D car procedural assembly
- Sensor network layer activation and hardware marker generation (55 meshes)
- Pinned callout card with 360-degree turntable inspector lifecycle
- Fault injection and recovery UI propagation
- Prev/Next sensor navigation and guided tour
- Search input and subsystem/authority filtering
- Exploded view with sensor marker tracking
- X-ray translucent chassis inspection mode
- Active-aero wing flap actuation
- Three.js resource cleanup (zero geometry and texture leaks)
- Zero console runtime errors.
Screenshots are saved automatically into the `screenshots/` directory for visual audit.

---

## 8. Deployment to Vercel

```bash
# Production deployment via Vercel CLI
npx vercel --prod
```
Or import the repository directly into your Vercel Dashboard. The build configuration outputs to `./dist` via Vite.

---

## 9. References & Technical Standards

- **FIA Formula 1 Technical Regulations (2026 Issue 20)** — Articles on Electrical Systems, Powertrain Energy Limits, and Active Aerodynamics.
- **McLaren Applied TAG-320 SECU Specification Guide** — Automotive DSP architecture, CAN-FD buses, and scrutineering telemetry logger specifications.
- **Bosch Motorsport & Texense Technical Documentation** — Miniature high-temperature pyrometers, strain gauge load cells, and differential Hall speed transducers.
