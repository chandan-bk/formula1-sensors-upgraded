/**
 * Formula 1 Simulated Telemetry & Motorsport IoT Dynamics Engine.
 *
 * Implements a physically coupled vehicle telemetry simulator driven by a representative
 * 84-second Formula 1 lap. All 32 sensor channels are computed from a coherent shared
 * vehicle state (velocity, acceleration, brake pressure, aerodynamic load, powertrain torque,
 * and chassis dynamics).
 *
 * Includes an aerospace-grade Sensor Fault Simulation Engine supporting 6 operational fault modes:
 *   1. Disconnected (Open circuit / 0 V signal loss)
 *   2. Stuck (ADC freeze / mechanical seizure)
 *   3. Noisy (High-frequency EMI interference from 350 kW MGU-K switching)
 *   4. Out of Range (Positive rail electrical saturation)
 *   5. Delayed (CAN queue latency / 3.0 s phase lag)
 *   6. Intermittent (Contact bounce / periodic signal dropouts)
 *
 * All figures and formulas are representative motorsport engineering approximations,
 * not confidential team proprietary data.
 */

export const LAP_TIME = 84; // seconds per simulated lap
export const TRACK_LENGTH_M = 5120; // 5.120 km representative Grand Prix circuit
export const SIM_HZ = 30; // 30 updates per second

/* -------------------------------------------------------------------------- */
/* Fault Simulation Definitions & Root-Cause Engineering Guides               */
/* -------------------------------------------------------------------------- */

export const FAULT_MODES = {
  none: {
    id: 'none',
    label: 'Nominal Operation',
    severity: 'nominal',
    code: 'OK',
    description: 'Sensor transducer and signal conditioning operating within normal calibration tolerances.',
    investigation: 'Channel healthy. Continue standard telemetry logging.',
  },
  disconnected: {
    id: 'disconnected',
    label: 'Disconnected (Open Circuit)',
    severity: 'critical',
    code: 'OPEN_CKT',
    description: 'Complete signal loss due to wiring loom disconnection, pin pull-out, or fractured transducer element. Signal drops to bottom rail.',
    investigation: 'Inspect MIL-DTL-38999 / Deutsch connector pin retention, test wiring harness continuity, and verify 5V sensor excitation supply rail.',
  },
  stuck: {
    id: 'stuck',
    label: 'Stuck (Frozen Reading)',
    severity: 'critical',
    code: 'ADC_FROZEN',
    description: 'Analog-to-Digital Converter frozen or mechanical linkage seized. Transducer outputs a constant frozen value regardless of car dynamics.',
    investigation: 'Cycle sensor interface power, check ADC SPI/I2C communication bus clock line, and inspect mechanical slider/pivot for mechanical seizure.',
  },
  noisy: {
    id: 'noisy',
    label: 'EMI Noise (Inverter Interference)',
    severity: 'warning',
    code: 'EMI_NOISE',
    description: 'Severe electromagnetic interference coupled from the high-voltage (900V) MGU-K inverter into unshielded analog signal lines.',
    investigation: 'Inspect 360-degree braided cable shielding termination, check chassis ground bond resistance (< 0.05 Ohm), and enable SECU hardware low-pass filter.',
  },
  out_of_range: {
    id: 'out_of_range',
    label: 'Out of Range (Rail Saturation)',
    severity: 'critical',
    code: 'SATURATION',
    description: 'Transducer internal short circuit or bridge failure causing output to saturate against the positive reference voltage rail (>130% full-scale).',
    investigation: 'Perform bench zero-span calibration check, verify bridge excitation current, and replace thermally damaged sensing element.',
  },
  delayed: {
    id: 'delayed',
    label: 'Signal Latency (CAN Buffer Lag)',
    severity: 'warning',
    code: 'CAN_LAG',
    description: 'Simulated CAN queue backlog or gateway buffer congestion introducing ~3.0 seconds of latency between physical event and telemetry record.',
    investigation: 'Examine CAN arbitration priority IDs, audit bus load utilization (target < 70%), and clear stale node queue buffers.',
  },
  intermittent: {
    id: 'intermittent',
    label: 'Intermittent (Contact Bounce)',
    severity: 'warning',
    code: 'INTERMITTENT',
    description: 'High-vibration road surface excitation inducing periodic contact bounce in connector terminals, causing rapid signal dropouts.',
    investigation: 'Inspect crimp terminal tension, replace fretted gold contacts, and add silicone potting/strain relief at suspension wishbone joints.',
  },
};

/* -------------------------------------------------------------------------- */
/* Comprehensive 32-Channel Telemetry Catalogue with Engineering Thresholds   */
/* -------------------------------------------------------------------------- */

export const CHANNELS = {
  // Wheels & Tyres
  wheelSpeed: {
    label: 'Wheel Speed',
    unit: 'rad/s',
    min: 0,
    max: 290,
    dp: 0,
    warnLo: 5,
    warnHi: 275,
    critLo: 0,
    critHi: 285,
    bandLo: 80,
    bandHi: 260,
    description: 'Angular rotational velocity of the wheel hub measured by optical/magnetic tone rings.',
  },
  tpms: {
    label: 'Tyre Pressure',
    unit: 'bar',
    min: 1.2,
    max: 2.2,
    dp: 2,
    warnLo: 1.38,
    warnHi: 1.95,
    critLo: 1.30,
    critHi: 2.10,
    bandLo: 1.45,
    bandHi: 1.85,
    description: 'Internal rim cavity inflation pressure monitored by mandatory FIA/Pirelli sensor.',
  },
  tyreSurf: {
    label: 'Tyre Surface Temp',
    unit: '°C',
    min: 40,
    max: 145,
    dp: 0,
    warnLo: 75,
    warnHi: 122,
    critLo: 60,
    critHi: 135,
    bandLo: 90,
    bandHi: 115,
    description: 'Infrared pyrometer measurement of tyre tread surface thermal state across shoulders.',
  },

  // Brakes & Suspension
  discTemp: {
    label: 'Brake Disc Temp',
    unit: '°C',
    min: 150,
    max: 1200,
    dp: 0,
    warnLo: 300,
    warnHi: 920,
    critLo: 200,
    critHi: 1050,
    bandLo: 400,
    bandHi: 850,
    description: 'Carbon-carbon brake disc rotor temperature via high-temperature infrared pyrometer.',
  },
  brakePress: {
    label: 'Brake Line Pressure',
    unit: 'bar',
    min: 0,
    max: 150,
    dp: 0,
    warnLo: undefined,
    warnHi: 135,
    critLo: undefined,
    critHi: 145,
    bandLo: 0,
    bandHi: 120,
    description: 'Hydraulic master cylinder pressure feeding the brake-by-wire (BBW) system.',
  },
  pushrod: {
    label: 'Pushrod Load',
    unit: 'kN',
    min: 0,
    max: 16,
    dp: 1,
    warnLo: undefined,
    warnHi: 12.5,
    critLo: undefined,
    critHi: 14.5,
    bandLo: 2.0,
    bandHi: 10.0,
    description: 'Dynamic wheel load and downforce transmitted through suspension pushrod load cell.',
  },
  damper: {
    label: 'Damper Travel',
    unit: 'mm',
    min: 0,
    max: 65,
    dp: 1,
    warnLo: undefined,
    warnHi: 52,
    critLo: undefined,
    critHi: 60,
    bandLo: 10,
    bandHi: 45,
    description: 'Linear suspension potentiometer measuring damper piston displacement.',
  },
  rideHeight: {
    label: 'Ride Height',
    unit: 'mm',
    min: 4,
    max: 45,
    dp: 1,
    warnLo: 7.5,
    warnHi: 38,
    critLo: 5.0,
    critHi: 42,
    bandLo: 10,
    bandHi: 30,
    description: 'Underfloor dynamic ground clearance measured by nose and keel laser sensors.',
  },
  steer: {
    label: 'Steering Angle',
    unit: '°',
    min: -160,
    max: 160,
    dp: 0,
    warnLo: -140,
    warnHi: 140,
    critLo: -155,
    critHi: 155,
    bandLo: -110,
    bandHi: 110,
    description: 'Driver steering handwheel angle from steering column optical encoder.',
  },

  // Aero & Airflow
  airspeed: {
    label: 'True Airspeed',
    unit: 'km/h',
    min: 0,
    max: 380,
    dp: 0,
    warnLo: undefined,
    warnHi: 360,
    critLo: undefined,
    critHi: 375,
    bandLo: 80,
    bandHi: 345,
    description: 'Dynamic pressure true airspeed measured by nose/airbox Pitot-static tube array.',
  },
  aeroFlap: {
    label: 'Wing Flap Angle',
    unit: '°',
    min: 0,
    max: 32,
    dp: 1,
    warnLo: undefined,
    warnHi: 30,
    critLo: undefined,
    critHi: 31.5,
    bandLo: 2,
    bandHi: 28,
    description: 'Movable aerodynamic wing flap angle for 2026 Straight Mode vs Corner Mode active aero.',
  },
  wingStrain: {
    label: 'Wing Pylon Strain',
    unit: 'µε',
    min: 0,
    max: 2800,
    dp: 0,
    warnLo: undefined,
    warnHi: 2400,
    critLo: undefined,
    critHi: 2650,
    bandLo: 400,
    bandHi: 2100,
    description: 'Foil strain gauge measurement of aerodynamic load on rear wing support pylons.',
  },
  ambient: {
    label: 'Ambient Air Temp',
    unit: '°C',
    min: 15,
    max: 50,
    dp: 1,
    warnLo: 18,
    warnHi: 42,
    critLo: 15,
    critHi: 46,
    bandLo: 22,
    bandHi: 36,
    description: 'Ambient atmospheric temperature used for air density and thermal management calculations.',
  },

  // Chassis & Safety
  imu: {
    label: 'Lateral Accel',
    unit: 'g',
    min: -5.5,
    max: 5.5,
    dp: 2,
    warnLo: -4.8,
    warnHi: 4.8,
    critLo: -5.2,
    critHi: 5.2,
    bandLo: -4.2,
    bandHi: 4.2,
    description: 'Chassis lateral acceleration from 6-axis central Inertial Measurement Unit (IMU).',
  },
  adrG: {
    label: 'Impact Channel (ADR)',
    unit: 'g',
    min: 0,
    max: 25,
    dp: 1,
    warnLo: undefined,
    warnHi: 8.0,
    critLo: undefined,
    critHi: 15.0,
    bandLo: 0,
    bandHi: 5.0,
    description: 'Chassis crash severity metric recorded by mandatory FIA Accident Data Recorder.',
  },
  lapDist: {
    label: 'Lap Distance',
    unit: 'm',
    min: 0,
    max: TRACK_LENGTH_M,
    dp: 0,
    description: 'Calculated along-track distance from the start/finish line.',
  },

  // Driver & Cockpit
  throttle: {
    label: 'Throttle Pedal',
    unit: '%',
    min: 0,
    max: 100,
    dp: 0,
    bandLo: 0,
    bandHi: 100,
    description: 'Fly-by-wire accelerator pedal displacement from dual redundant potentiometers.',
  },
  heartRate: {
    label: 'Driver Heart Rate',
    unit: 'bpm',
    min: 70,
    max: 210,
    dp: 0,
    warnLo: 85,
    warnHi: 188,
    critLo: 65,
    critHi: 200,
    bandLo: 120,
    bandHi: 180,
    description: 'Biometric optical pulse oximeter sensor embedded in FIA mandatory driver glove.',
  },
  headG: {
    label: 'Head Accel (In-Ear)',
    unit: 'g',
    min: 0,
    max: 10,
    dp: 2,
    warnLo: undefined,
    warnHi: 5.5,
    critLo: undefined,
    critHi: 7.5,
    bandLo: 0,
    bandHi: 4.5,
    description: 'Kinematic head acceleration measured by micro-accelerometers inside driver earplugs.',
  },
  flag: {
    label: 'FIA Track Flag',
    unit: '',
    min: 0,
    max: 3,
    dp: 0,
    text: (v) => ['GREEN', 'YELLOW', 'DOUBLE YELLOW', 'RED'][Math.round(v)] || 'GREEN',
    description: 'FIA Race Control marshaling sector flag status transmitted over trackside UHF.',
  },

  // Engine & Fuel
  rpm: {
    label: 'Engine Speed',
    unit: 'rpm',
    min: 3500,
    max: 15500,
    dp: 0,
    warnLo: 4200,
    warnHi: 14750,
    critLo: 3800,
    critHi: 15100,
    bandLo: 9500,
    bandHi: 14500,
    description: 'Internal Combustion Engine crankshaft rotational speed from Hall-effect sensor.',
  },
  fuelFlow: {
    label: 'Fuel Energy Flow',
    unit: 'MJ/h',
    min: 0,
    max: 3300,
    dp: 0,
    warnLo: undefined,
    warnHi: 3000,
    critLo: undefined,
    critHi: 3010,
    limit: 3000,
    bandLo: 0,
    bandHi: 2980,
    description: 'Instantaneous fuel energy flow monitored by mandatory FIA ultrasonic flow meter.',
  },
  fuelPress: {
    label: 'Common Rail Pressure',
    unit: 'bar',
    min: 0,
    max: 540,
    dp: 0,
    warnLo: 200,
    warnHi: 505,
    critLo: 150,
    critHi: 525,
    bandLo: 280,
    bandHi: 495,
    description: 'High-pressure direct injection fuel rail transducer (up to 500 bar).',
  },
  coolant: {
    label: 'Coolant Temp',
    unit: '°C',
    min: 60,
    max: 140,
    dp: 0,
    warnLo: 78,
    warnHi: 116,
    critLo: 65,
    critHi: 125,
    bandLo: 90,
    bandHi: 110,
    description: 'Internal combustion engine water jacket and oil circuit thermal probe.',
  },
  lambda: {
    label: 'Exhaust Lambda',
    unit: 'λ',
    min: 0.75,
    max: 1.35,
    dp: 2,
    warnLo: 0.88,
    warnHi: 1.18,
    critLo: 0.82,
    critHi: 1.25,
    bandLo: 0.95,
    bandHi: 1.05,
    description: 'Exhaust gas air-fuel equivalence ratio from wideband planar zirconia sensor.',
  },
  turbo: {
    label: 'Turbo Shaft Speed',
    unit: 'krpm',
    min: 0,
    max: 135,
    dp: 1,
    warnLo: undefined,
    warnHi: 124,
    critLo: undefined,
    critHi: 130,
    bandLo: 40,
    bandHi: 120,
    description: 'Turbocharger compressor shaft rotational speed from optical/eddy-current pickup.',
  },

  // Hybrid & Drivetrain
  mgukPower: {
    label: 'MGU-K Power',
    unit: 'kW',
    min: -360,
    max: 360,
    dp: 0,
    warnLo: -355,
    warnHi: 355,
    critLo: -360,
    critHi: 360,
    bandLo: -350,
    bandHi: 350,
    description: 'Motor Generator Unit - Kinetic electrical deploy (+) and regenerative braking (-) power.',
  },
  soc: {
    label: 'Battery State of Charge',
    unit: '%',
    min: 0,
    max: 100,
    dp: 0,
    warnLo: 8,
    warnHi: 96,
    critLo: 4,
    critHi: 99,
    bandLo: 15,
    bandHi: 90,
    description: 'Energy Store high-voltage battery state of charge from Battery Management System.',
  },
  shaftTorque: {
    label: 'Driveshaft Torque',
    unit: 'Nm',
    min: -900,
    max: 4500,
    dp: 0,
    warnLo: -600,
    warnHi: 4250,
    critLo: -800,
    critHi: 4400,
    bandLo: 0,
    bandHi: 4100,
    description: 'Rear driveshaft delivered mechanical torque measured by FIA telemetry collars.',
  },
  gear: {
    label: 'Selected Gear',
    unit: '',
    min: 1,
    max: 8,
    dp: 0,
    description: 'Selected transmission gear ratio (1–8) from gearbox selector barrel sensor.',
  },

  // Electronics & Telemetry
  canLoad: {
    label: 'CAN Bus Utilization',
    unit: '%',
    min: 0,
    max: 100,
    dp: 0,
    warnLo: undefined,
    warnHi: 82,
    critLo: undefined,
    critHi: 92,
    bandLo: 35,
    bandHi: 75,
    description: 'SECU internal vehicle CAN network utilization metric (simulated).',
  },
  rssi: {
    label: 'Telemetry Signal (RSSI)',
    unit: 'dBm',
    min: -100,
    max: -35,
    dp: 0,
    warnLo: -84,
    warnHi: undefined,
    critLo: -92,
    critHi: undefined,
    bandLo: -75,
    bandHi: -45,
    description: 'Car-to-pit wireless telemetry RF received signal strength indication (simulated).',
  },
};

/* -------------------------------------------------------------------------- */
/* Lap Profile Physics Definition                                             */
/* -------------------------------------------------------------------------- */

const SPEED_PTS = [
  [0.0, 308], [0.115, 324], [0.14, 96], [0.2, 84], [0.27, 238], [0.335, 252],
  [0.36, 132], [0.4, 150], [0.47, 288], [0.57, 306], [0.595, 182], [0.665, 258],
  [0.76, 300], [0.805, 122], [0.865, 212], [1.0, 308],
];

const CORNERS = [
  [0.17, 1.0, 0.034], [0.29, 0.28, 0.02], [0.375, -0.5, 0.012], [0.41, 0.5, 0.012],
  [0.625, 0.55, 0.026], [0.835, -0.72, 0.03], [0.915, 0.25, 0.02],
];

const KERBS = [0.185, 0.395, 0.835];
const GEAR_TOP = [95, 130, 165, 205, 245, 285, 320, 355]; // km/h limit per gear at 15,000 rpm

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const cosInterp = (a, b, t) => a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * t));
const noise = (t, seed) =>
  Math.sin(t * (13.1 + seed) + seed * 7.3) * 0.5 +
  Math.sin(t * (31.7 + seed * 2) + seed) * 0.3 +
  Math.sin(t * (71 + seed)) * 0.2;

export function speedAt(phase) {
  for (let i = 0; i < SPEED_PTS.length - 1; i++) {
    const [p0, v0] = SPEED_PTS[i];
    const [p1, v1] = SPEED_PTS[i + 1];
    if (phase >= p0 && phase <= p1) return cosInterp(v0, v1, (phase - p0) / (p1 - p0));
  }
  return SPEED_PTS[0][1];
}

function steerAt(phase) {
  let s = 0;
  for (const [c, a, w] of CORNERS) s += a * Math.exp(-(((phase - c) / w) ** 2));
  return clamp(s, -1, 1);
}

/* -------------------------------------------------------------------------- */
/* Factory: createTelemetry()                                                 */
/* -------------------------------------------------------------------------- */

export function createTelemetry() {
  const HZ = SIM_HZ;
  const HISTORY = 360; // 12-second rolling window at 30 Hz
  const keys = Object.keys(CHANNELS);
  const history = Object.fromEntries(keys.map((k) => [k, new Float32Array(HISTORY)]));
  const rawHistory = Object.fromEntries(keys.map((k) => [k, new Float32Array(HISTORY)]));
  const state = Object.fromEntries(keys.map((k) => [k, 0]));
  const rawState = Object.fromEntries(keys.map((k) => [k, 0]));

  Object.assign(state, { speed: 300, brake: 0, longG: 0, latG: 0, phase: 0, t: 0 });
  Object.assign(rawState, { speed: 300, brake: 0, longG: 0, latG: 0, phase: 0, t: 0 });

  // Delay buffers for delayed fault mode (3 seconds = 90 frames)
  const delayBuffers = Object.fromEntries(keys.map((k) => [k, new Float32Array(180)]));
  let delayHead = 0;

  // Active faults store: channelKey -> { type: string, stuckValue: number, startTime: number }
  const faults = new Map();

  const sim = {
    state,
    rawState,
    history,
    HISTORY,
    head: 0,
    running: true,
    rate: 1,
    faults,
    _acc: 0,
    _gear: 6,
    _thr: 100,
    _brk: 0,
    _disc: 420,
    _tyre: 88,
    _flap: 4,
    _soc: 62,
    _coolant: 101,
    _prevSpeed: 300,
    _lastStepReal: performance.now(),
  };

  /** Compute standard vehicle physics step */
  function computePhysics(dt) {
    const s = sim.rawState;
    s.t += dt;
    const phase = (s.t / LAP_TIME) % 1;
    s.phase = phase;
    const v = speedAt(phase);
    const a = (v - sim._prevSpeed) / 3.6 / Math.max(dt, 1e-3); // m/s²
    sim._prevSpeed = v;
    s.speed = v;
    s.longG = clamp(a / 9.81, -5.2, 2.4);

    // Pedals with human foot lag
    const thrTarget = a > 0.3 ? 100 : a > -2.2 ? (v > 215 ? 100 : 42) : 0;
    const brkTarget = a < -5 ? clamp(45 + -a * 1.6, 0, 100) : a < -2.2 ? 25 : 0;
    sim._thr += (thrTarget - sim._thr) * (1 - Math.exp(-dt * 14));
    sim._brk += (brkTarget - sim._brk) * (1 - Math.exp(-dt * 22));
    s.throttle = clamp(sim._thr, 0, 100);
    s.brake = clamp(sim._brk, 0, 100);

    // Gearbox logic with shift hysteresis
    const g0 = sim._gear;
    if (v / GEAR_TOP[g0 - 1] > 0.93 && g0 < 8) sim._gear++;
    else if (v / GEAR_TOP[g0 - 1] < 0.5 && g0 > 1) sim._gear--;
    s.gear = sim._gear;
    s.rpm = clamp((v / GEAR_TOP[s.gear - 1]) * 15000 + noise(s.t, 1) * 60, 4200, 15000);

    // Cornering and chassis kinematics
    const st = steerAt(phase);
    s.steer = st * 130 + noise(s.t, 2) * 1.2;
    s.latG = st * (1.2 + 3.4 * clamp((v - 80) / 180, 0, 1));
    s.imu = s.latG + noise(s.t, 3) * 0.06;
    const vv = (v / 322) ** 2;
    const kerb = KERBS.reduce((m, c) => Math.max(m, Math.exp(-(((phase - c) / 0.0035) ** 2))), 0);

    s.wheelSpeed = v / 3.6 / 0.34 + noise(s.t, 4) * 0.6;
    s.airspeed = v + noise(s.t, 5) * 2.5;
    s.rideHeight = clamp(32 - 15 * vv - 2 * Math.max(0, -s.longG) + noise(s.t, 6) * 0.7 - kerb * 3, 6, 40);
    s.damper = clamp(20 + 11 * vv + 2.4 * Math.max(0, -s.longG) + noise(s.t, 7) * 1.1 + kerb * 9, 0, 60);
    s.pushrod = clamp(2.4 + 4.3 * vv + 0.35 * Math.max(0, -s.longG) * 2 + 0.45 * Math.abs(s.latG) + kerb * 3.4 + noise(s.t, 8) * 0.12, 0, 14);
    s.brakePress = clamp(s.brake * 1.25 + (s.brake > 2 ? 5 : 0), 0, 140);

    // Brake disc thermal dynamics
    const discTarget = 360 + 560 * (s.brake / 100) - 40 * vv;
    const kD = discTarget > sim._disc ? 2.8 : 0.35;
    sim._disc += (discTarget - sim._disc) * (1 - Math.exp(-dt * kD));
    s.discTemp = sim._disc + noise(s.t, 9) * 2;

    // Tyre surface thermodynamics
    const tyreTarget = 88 + 17 * (Math.abs(s.latG) / 4) + 8 * (s.brake / 100) + 4 * vv;
    sim._tyre += (tyreTarget - sim._tyre) * (1 - Math.exp(-dt * 0.9));
    s.tyreSurf = sim._tyre + noise(s.t, 10) * 0.4;
    s.tpms = 1.42 + 0.011 * (s.tyreSurf - 92) + noise(s.t, 11) * 0.004;

    // Active aero wings (Straight Mode vs Corner Mode)
    const straight = v > 205 && Math.abs(st) < 0.12 && s.brake < 8;
    sim._flap += ((straight ? 3 : 26) - sim._flap) * (1 - Math.exp(-dt * 9));
    s.aeroFlap = sim._flap;
    s.wingStrain = clamp(380 + 1950 * vv * (0.55 + 0.45 * (sim._flap / 26)) + noise(s.t, 12) * 24 + kerb * 120, 0, 2600);

    // Environmental & Safety sensors
    s.ambient = 31.4 + Math.sin(s.t * 0.01) * 0.2 + noise(s.t, 13) * 0.05;
    s.adrG = clamp(0.5 + Math.abs(noise(s.t, 14)) * 0.6 + kerb * 6.5, 0, 20);
    s.lapDist = phase * TRACK_LENGTH_M;
    s.heartRate = 150 + 18 * (Math.abs(s.latG) / 5) + 6 * (s.brake / 100) + noise(s.t, 15) * 1.2;
    s.headG = clamp(Math.abs(s.latG) * 0.55 + Math.abs(noise(s.t, 16)) * 0.15 + kerb * 1.4, 0, 8);
    s.flag = phase > 0.44 && phase < 0.55 ? 1 : 0;

    // Powertrain & Fuel
    s.fuelFlow = clamp(3000 * (s.throttle / 100) * Math.pow(s.rpm / 15000, 0.3), 0, 3010);
    s.fuelPress = clamp(260 + 240 * (s.rpm / 15000) * Math.sqrt(s.throttle / 100), 0, 505);
    sim._coolant += ((100 + 15 * (s.throttle / 100) * (s.rpm / 15000) + 4 * vv - 6 * (s.brake / 100)) - sim._coolant) * (1 - Math.exp(-dt * 0.3));
    s.coolant = sim._coolant;
    s.lambda = 1.0 + 0.2 * (1 - s.throttle / 100) - 0.05 * (s.throttle / 100) + noise(s.t, 17) * 0.008;
    s.turbo = clamp(38 + 88 * (s.throttle / 100) * (s.rpm / 15000) + noise(s.t, 18) * 0.8, 0, 130);

    // Hybrid energy management
    const deployOk = a > 1.2 && sim._soc > 4;
    const taper = 1 - clamp((v - 290) / 60, 0, 1);
    const regen = -350 * (s.brake / 100) * (sim._soc < 98 ? 1 : 0);
    s.mgukPower = deployOk ? 350 * taper * (s.throttle / 100) : s.brake > 2 ? regen : s.throttle < 60 ? -30 : 0;
    sim._soc = clamp(sim._soc - (s.mgukPower / 350) * dt * 8.8, 3, 100);
    s.soc = sim._soc;
    s.shaftTorque = s.brake > 5 ? -300 * (s.brake / 100) : 600 + 4200 * (s.throttle / 100) * (1 - v / 390);

    // Electronics & link health
    s.canLoad = 44 + 18 * (s.rpm / 15000) + 6 * Math.abs(noise(s.t, 19)) + (sim._gear !== g0 ? 14 : 0);
    s.rssi = -58 - 16 * Math.abs(Math.sin(phase * Math.PI * 6.6)) + noise(s.t, 20) * 2;
  }

  /** Apply fault simulation modifications to produce effective output state */
  function applyFaults() {
    const s = sim.state;
    const r = sim.rawState;
    s.speed = r.speed;
    s.brake = r.brake;
    s.longG = r.longG;
    s.latG = r.latG;
    s.phase = r.phase;
    s.t = r.t;

    for (const k of keys) {
      const def = CHANNELS[k];
      let val = r[k];
      const fault = faults.get(k);

      // Record to delay ring buffer
      delayBuffers[k][delayHead] = val;

      if (fault) {
        switch (fault.type) {
          case 'disconnected':
            val = def.min <= 0 && def.max > 0 ? 0 : def.min;
            break;
          case 'stuck':
            val = fault.stuckValue ?? val;
            break;
          case 'noisy': {
            const span = def.max - def.min;
            const jitter = (Math.sin(s.t * 190 + k.length) * 0.22 + (Math.random() - 0.5) * 0.38) * span;
            val = clamp(val + jitter, def.min, def.max);
            break;
          }
          case 'out_of_range': {
            const span = def.max - def.min;
            val = def.max + span * 0.25;
            break;
          }
          case 'delayed': {
            // Retrieve value from 90 frames ago (3.0s at 30Hz)
            const dIdx = (delayHead - 90 + 180) % 180;
            val = delayBuffers[k][dIdx];
            break;
          }
          case 'intermittent': {
            // Signal drops to 0 periodically for ~0.25s every 0.8s
            const drop = (Math.sin(s.t * 7.5 + k.length) > 0.55);
            fault.inDropout = drop;
            if (drop) val = def.min <= 0 && def.max > 0 ? 0 : def.min;
            break;
          }
          default:
            break;
        }
      }
      s[k] = val;
    }
    delayHead = (delayHead + 1) % 180;
  }

  /** Step simulator by delta time */
  sim.step = function step(dtReal) {
    if (!sim.running) return false;
    sim._acc += Math.min(dtReal, 0.1) * sim.rate;
    const dt = 1 / HZ;
    let advanced = false;
    while (sim._acc >= dt) {
      sim._acc -= dt;
      computePhysics(dt);
      applyFaults();
      for (const k of keys) {
        history[k][sim.head] = sim.state[k];
        rawHistory[k][sim.head] = sim.rawState[k];
      }
      sim.head = (sim.head + 1) % HISTORY;
      advanced = true;
    }
    return advanced;
  };

  /** Reset simulation to start of lap */
  sim.reset = function reset() {
    sim.rawState.t = 0;
    sim.state.t = 0;
    sim._acc = 0;
    sim._gear = 6;
    sim._thr = 100;
    sim._brk = 0;
    sim._disc = 420;
    sim._tyre = 88;
    sim._flap = 4;
    sim._soc = 62;
    sim._coolant = 101;
    sim._prevSpeed = 308;
    delayHead = 0;
    for (const k of keys) delayBuffers[k].fill(0);

    // Warm buffers up to start line
    sim.rawState.t = LAP_TIME - (HISTORY + HZ * 2) / HZ;
    for (let i = 0; i < HISTORY + HZ * 2; i++) {
      computePhysics(1 / HZ);
      applyFaults();
      for (const k of keys) history[k][sim.head] = sim.state[k];
      sim.head = (sim.head + 1) % HISTORY;
    }
  };

  /** Replay simulation from start of lap */
  sim.replay = function replay() {
    sim.reset();
    sim.running = true;
  };

  /** Inject a fault mode into a channel */
  sim.injectFault = function injectFault(channelKey, faultType) {
    if (!CHANNELS[channelKey]) return false;
    if (!faultType || faultType === 'none') {
      faults.delete(channelKey);
      return true;
    }
    const def = FAULT_MODES[faultType];
    if (!def) return false;
    faults.set(channelKey, {
      type: faultType,
      stuckValue: sim.state[channelKey],
      startTime: sim.state.t,
      info: def,
    });
    applyFaults();
    return true;
  };

  /** Clear fault on a channel */
  sim.clearFault = function clearFault(channelKey) {
    const res = faults.delete(channelKey);
    applyFaults();
    return res;
  };

  /** Clear all active faults */
  sim.clearAllFaults = function clearAllFaults() {
    faults.clear();
    applyFaults();
  };

  /** Get active fault on a channel */
  sim.getFault = function getFault(channelKey) {
    return faults.get(channelKey) || null;
  };

  /** Return evaluation of current health/alarm status of a channel */
  sim.getStatus = function getStatus(channelKey) {
    const def = CHANNELS[channelKey];
    if (!def) return { status: 'Nominal', severity: 'nominal', text: 'Nominal', code: 'OK' };

    const fault = faults.get(channelKey);
    if (fault) {
      if (fault.type === 'intermittent' && fault.inDropout) {
        return {
          status: 'FAULT: Signal Dropout (Contact Bounce)',
          severity: 'critical',
          text: 'Signal Dropout',
          code: 'DROP_OUT',
          fault,
        };
      }
      const mode = FAULT_MODES[fault.type];
      return {
        status: `FAULT: ${mode.label}`,
        severity: mode.severity,
        text: mode.label,
        code: mode.code,
        fault,
      };
    }

    const val = sim.state[channelKey];
    const crit =
      (def.critHi !== undefined && val >= def.critHi) ||
      (def.critLo !== undefined && val <= def.critLo);
    if (crit) {
      return { status: 'Critical Alarm', severity: 'critical', text: 'Critical', code: 'CRIT' };
    }

    const warn =
      (def.warnHi !== undefined && val >= def.warnHi) ||
      (def.warnLo !== undefined && val <= def.warnLo);
    if (warn) {
      return { status: 'Warning', severity: 'warning', text: 'Warning', code: 'WARN' };
    }

    return { status: 'Nominal', severity: 'nominal', text: 'Nominal', code: 'OK' };
  };

  /** Normalised 0..1 reading for a channel (for 3D glow and gauges) */
  sim.norm = function norm(key) {
    const c = CHANNELS[key];
    if (!c) return 0;
    return clamp((sim.state[key] - c.min) / (c.max - c.min), 0, 1);
  };

  /** Series in time order (oldest first) for scope drawing */
  sim.series = function series(key, out) {
    const h = history[key];
    const n = HISTORY;
    const arr = out && out.length === n ? out : new Float32Array(n);
    for (let i = 0; i < n; i++) arr[i] = h[(sim.head + i) % n];
    return arr;
  };

  /** Format a channel's current value */
  sim.format = function format(key) {
    const c = CHANNELS[key];
    const v = sim.state[key];
    if (!c) return '';
    return c.text ? c.text(v) : v.toFixed(c.dp);
  };

  /** Return formatted session timestamp */
  sim.getTimestamp = function getTimestamp() {
    const t = sim.state.t % LAP_TIME;
    const mins = Math.floor(t / 60);
    const secs = (t % 60).toFixed(2).padStart(5, '0');
    return {
      lapTime: t,
      formattedTime: `${mins}:${secs}`,
      lapProgress: (t / LAP_TIME) * 100,
      distM: Math.round(sim.state.lapDist),
    };
  };

  /** Pre-warm buffers ending exactly at the start line */
  sim.reset();

  return sim;
}

/** Stylised circuit outline (unit square) for the mini map */
export const TRACK_OUTLINE = [
  [0.08, 0.62], [0.2, 0.62], [0.42, 0.62], [0.62, 0.62], [0.78, 0.6], [0.9, 0.5], [0.92, 0.34],
  [0.84, 0.22], [0.7, 0.26], [0.62, 0.38], [0.52, 0.3], [0.46, 0.14], [0.34, 0.1], [0.24, 0.18],
  [0.2, 0.32], [0.12, 0.38], [0.06, 0.5],
];
