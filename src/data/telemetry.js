/**
 * Live telemetry lap simulator.
 *
 * A single representative lap is looped. Every sensor in the catalogue reads one
 * "channel" from this simulator, so the readouts, scope traces and 3D glow all
 * tell one consistent story: brake hard -> discs heat, MGU-K regenerates, the
 * gearbox downshifts, the tyres load up, and so on.
 *
 * All numbers are representative, not team data.
 */

export const LAP_TIME = 84; // seconds per simulated lap
export const TRACK_LENGTH_M = 5120;

/* ---- channel catalogue: label, unit, display range and (optional) alarm limits ---- */
export const CHANNELS = {
  wheelSpeed: { label: 'Wheel speed', unit: 'rad/s', min: 0, max: 280, dp: 0 },
  tpms: { label: 'Tyre pressure', unit: 'bar', min: 1.3, max: 1.8, dp: 2, warnLo: 1.36 },
  tyreSurf: { label: 'Tyre surface temp', unit: '°C', min: 60, max: 130, dp: 0, warnHi: 120 },
  discTemp: { label: 'Brake disc temp', unit: '°C', min: 200, max: 1000, dp: 0, warnHi: 880, bandLo: 350, bandHi: 800 },
  brakePress: { label: 'Brake line pressure', unit: 'bar', min: 0, max: 140, dp: 0 },
  pushrod: { label: 'Pushrod load', unit: 'kN', min: 0, max: 14, dp: 1 },
  damper: { label: 'Damper travel', unit: 'mm', min: 0, max: 60, dp: 1 },
  rideHeight: { label: 'Ride height', unit: 'mm', min: 5, max: 40, dp: 1, warnLo: 8 },
  steer: { label: 'Steering angle', unit: '°', min: -150, max: 150, dp: 0 },
  airspeed: { label: 'True airspeed', unit: 'km/h', min: 0, max: 360, dp: 0 },
  aeroFlap: { label: 'Wing flap angle', unit: '°', min: 0, max: 30, dp: 1 },
  wingStrain: { label: 'Pylon strain', unit: 'µε', min: 0, max: 2600, dp: 0 },
  ambient: { label: 'Ambient air temp', unit: '°C', min: 20, max: 45, dp: 1 },
  imu: { label: 'Lateral accel', unit: 'g', min: -5, max: 5, dp: 2 },
  adrG: { label: 'Impact channel', unit: 'g', min: 0, max: 20, dp: 1 },
  lapDist: { label: 'Lap distance', unit: 'm', min: 0, max: TRACK_LENGTH_M, dp: 0 },
  throttle: { label: 'Throttle pedal', unit: '%', min: 0, max: 100, dp: 0 },
  heartRate: { label: 'Heart rate', unit: 'bpm', min: 90, max: 200, dp: 0, warnHi: 190 },
  headG: { label: 'Head accel', unit: 'g', min: 0, max: 8, dp: 2 },
  flag: { label: 'Track status', unit: '', min: 0, max: 3, dp: 0, text: (v) => ['GREEN', 'YELLOW', 'DOUBLE YELLOW', 'RED'][Math.round(v)] || 'GREEN' },
  rpm: { label: 'Engine speed', unit: 'rpm', min: 4000, max: 15000, dp: 0, warnHi: 14800 },
  fuelFlow: { label: 'Fuel energy flow', unit: 'MJ/h', min: 0, max: 3200, dp: 0, warnHi: 3000, limit: 3000 },
  fuelPress: { label: 'Rail pressure', unit: 'bar', min: 0, max: 520, dp: 0, warnHi: 500 },
  coolant: { label: 'Coolant temp', unit: '°C', min: 70, max: 130, dp: 0, warnHi: 118 },
  lambda: { label: 'Lambda', unit: 'λ', min: 0.8, max: 1.3, dp: 2 },
  turbo: { label: 'Turbo shaft speed', unit: 'krpm', min: 0, max: 130, dp: 1, warnHi: 125 },
  mgukPower: { label: 'MGU-K power', unit: 'kW', min: -350, max: 350, dp: 0 },
  soc: { label: 'Battery usage', unit: '%', min: 0, max: 100, dp: 0, warnLo: 6 },
  shaftTorque: { label: 'Driveshaft torque', unit: 'Nm', min: -800, max: 4200, dp: 0 },
  gear: { label: 'Gear', unit: '', min: 1, max: 8, dp: 0 },
  canLoad: { label: 'CAN bus load', unit: '%', min: 0, max: 100, dp: 0, warnHi: 85 },
  rssi: { label: 'Radio link strength', unit: 'dBm', min: -95, max: -40, dp: 0, warnLo: -85 },
};

/* ---- the lap: speed control points (phase 0..1, km/h) ---- */
const SPEED_PTS = [
  [0.0, 308], [0.115, 324], [0.14, 96], [0.2, 84], [0.27, 238], [0.335, 252],
  [0.36, 132], [0.4, 150], [0.47, 288], [0.57, 306], [0.595, 182], [0.665, 258],
  [0.76, 300], [0.805, 122], [0.865, 212], [1.0, 308],
];
/* corners: [phase centre, signed amplitude, width] */
const CORNERS = [
  [0.17, 1.0, 0.034], [0.29, 0.28, 0.02], [0.375, -0.5, 0.012], [0.41, 0.5, 0.012],
  [0.625, 0.55, 0.026], [0.835, -0.72, 0.03], [0.915, 0.25, 0.02],
];
const KERBS = [0.185, 0.395, 0.835];
const GEAR_TOP = [95, 130, 165, 205, 245, 285, 320, 355]; // km/h at 15,000 rpm

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const cosInterp = (a, b, t) => a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * t));
const noise = (t, seed) => Math.sin(t * (13.1 + seed) + seed * 7.3) * 0.5 + Math.sin(t * (31.7 + seed * 2) + seed) * 0.3 + Math.sin(t * (71 + seed)) * 0.2;

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

export function createTelemetry() {
  const HZ = 30;
  const HISTORY = 360; // 12 s window
  const keys = Object.keys(CHANNELS);
  const history = Object.fromEntries(keys.map((k) => [k, new Float32Array(HISTORY)]));
  const state = Object.fromEntries(keys.map((k) => [k, 0]));
  Object.assign(state, { speed: 300, brake: 0, longG: 0, latG: 0, phase: 0, t: 0 });

  const sim = {
    state,
    history,
    HISTORY,
    head: 0, // index of the next sample slot
    running: true,
    rate: 1,
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
  };

  function compute(dt) {
    const s = state;
    s.t += dt;
    const phase = (s.t / LAP_TIME) % 1;
    s.phase = phase;
    const v = speedAt(phase);
    const a = (v - sim._prevSpeed) / 3.6 / Math.max(dt, 1e-3); // m/s²
    sim._prevSpeed = v;
    s.speed = v;
    s.longG = clamp(a / 9.81, -5.2, 2.4);

    // pedals (low-passed so the traces look like a human foot, not a square wave)
    const thrTarget = a > 0.3 ? 100 : a > -2.2 ? (v > 215 ? 100 : 42) : 0;
    const brkTarget = a < -5 ? clamp(45 + -a * 1.6, 0, 100) : a < -2.2 ? 25 : 0;
    sim._thr += (thrTarget - sim._thr) * (1 - Math.exp(-dt * 14));
    sim._brk += (brkTarget - sim._brk) * (1 - Math.exp(-dt * 22));
    s.throttle = clamp(sim._thr, 0, 100);
    s.brake = clamp(sim._brk, 0, 100);

    // gearbox with hysteresis
    const g0 = sim._gear;
    if (v / GEAR_TOP[g0 - 1] > 0.93 && g0 < 8) sim._gear++;
    else if (v / GEAR_TOP[g0 - 1] < 0.5 && g0 > 1) sim._gear--;
    s.gear = sim._gear;
    s.rpm = clamp((v / GEAR_TOP[s.gear - 1]) * 15000 + noise(s.t, 1) * 60, 4200, 15000);

    // corner / chassis dynamics
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

    // brake disc: heats fast, cools slowly (more when fast)
    const discTarget = 360 + 560 * (s.brake / 100) - 40 * vv;
    const kD = discTarget > sim._disc ? 2.8 : 0.35;
    sim._disc += (discTarget - sim._disc) * (1 - Math.exp(-dt * kD));
    s.discTemp = sim._disc + noise(s.t, 9) * 2;

    // tyre surface: slow thermal mass
    const tyreTarget = 88 + 17 * (Math.abs(s.latG) / 4) + 8 * (s.brake / 100) + 4 * vv;
    sim._tyre += (tyreTarget - sim._tyre) * (1 - Math.exp(-dt * 0.9));
    s.tyreSurf = sim._tyre + noise(s.t, 10) * 0.4;
    s.tpms = 1.42 + 0.011 * (s.tyreSurf - 92) + noise(s.t, 11) * 0.004;

    // active aero: Straight Mode on straights, Corner Mode otherwise
    const straight = v > 205 && Math.abs(st) < 0.12 && s.brake < 8;
    sim._flap += ((straight ? 3 : 26) - sim._flap) * (1 - Math.exp(-dt * 9));
    s.aeroFlap = sim._flap;
    s.wingStrain = clamp(380 + 1950 * vv * (0.55 + 0.45 * (sim._flap / 26)) + noise(s.t, 12) * 24 + kerb * 120, 0, 2600);

    s.ambient = 31.4 + Math.sin(s.t * 0.01) * 0.2 + noise(s.t, 13) * 0.05;
    s.adrG = clamp(0.5 + Math.abs(noise(s.t, 14)) * 0.6 + kerb * 6.5, 0, 20);
    s.lapDist = phase * TRACK_LENGTH_M;
    s.heartRate = 150 + 18 * (Math.abs(s.latG) / 5) + 6 * (s.brake / 100) + noise(s.t, 15) * 1.2;
    s.headG = clamp(Math.abs(s.latG) * 0.55 + Math.abs(noise(s.t, 16)) * 0.15 + kerb * 1.4, 0, 8);
    s.flag = phase > 0.44 && phase < 0.55 ? 1 : 0;

    // engine / fuel
    s.fuelFlow = clamp(3000 * (s.throttle / 100) * Math.pow(s.rpm / 15000, 0.3), 0, 3010);
    s.fuelPress = clamp(260 + 240 * (s.rpm / 15000) * Math.sqrt(s.throttle / 100), 0, 505);
    sim._coolant += ((100 + 15 * (s.throttle / 100) * (s.rpm / 15000) + 4 * vv - 6 * (s.brake / 100)) - sim._coolant) * (1 - Math.exp(-dt * 0.3));
    s.coolant = sim._coolant;
    s.lambda = 1.0 + 0.2 * (1 - s.throttle / 100) - 0.05 * (s.throttle / 100) + noise(s.t, 17) * 0.008;
    s.turbo = clamp(38 + 88 * (s.throttle / 100) * (s.rpm / 15000) + noise(s.t, 18) * 0.8, 0, 130);

    // hybrid: deploy while accelerating hard, regenerate under braking, taper above ~290 km/h
    const deployOk = a > 1.2 && sim._soc > 4;
    const taper = 1 - clamp((v - 290) / 60, 0, 1);
    const regen = -350 * (s.brake / 100) * (sim._soc < 98 ? 1 : 0);
    s.mgukPower = deployOk ? 350 * taper * (s.throttle / 100) : s.brake > 2 ? regen : s.throttle < 60 ? -30 : 0;
    sim._soc = clamp(sim._soc - (s.mgukPower / 350) * dt * 8.8, 3, 100);
    s.soc = sim._soc;
    s.shaftTorque = s.brake > 5 ? -300 * (s.brake / 100) : 600 + 4200 * (s.throttle / 100) * (1 - v / 390);

    s.canLoad = 44 + 18 * (s.rpm / 15000) + 6 * Math.abs(noise(s.t, 19)) + (sim._gear !== g0 ? 14 : 0);
    s.rssi = -58 - 16 * Math.abs(Math.sin(phase * Math.PI * 6.6)) + noise(s.t, 20) * 2;
  }

  sim.step = function step(dtReal) {
    if (!sim.running) return false;
    sim._acc += Math.min(dtReal, 0.1) * sim.rate;
    const dt = 1 / HZ;
    let advanced = false;
    while (sim._acc >= dt) {
      sim._acc -= dt;
      compute(dt);
      for (const k of keys) history[k][sim.head] = state[k];
      sim.head = (sim.head + 1) % HISTORY;
      advanced = true;
    }
    return advanced;
  };

  /** Normalised 0..1 reading for a channel (for 3D glow and gauges). */
  sim.norm = (key) => {
    const c = CHANNELS[key];
    if (!c) return 0;
    return clamp((state[key] - c.min) / (c.max - c.min), 0, 1);
  };

  /** Series in time order (oldest first) for scope drawing. */
  sim.series = (key, out) => {
    const h = history[key];
    const n = HISTORY;
    const arr = out && out.length === n ? out : new Float32Array(n);
    for (let i = 0; i < n; i++) arr[i] = h[(sim.head + i) % n];
    return arr;
  };

  sim.format = (key) => {
    const c = CHANNELS[key];
    const v = state[key];
    if (!c) return '';
    return c.text ? c.text(v) : v.toFixed(c.dp);
  };

  // warm the buffers so the scope is full from the first frame, ending exactly at the start line
  state.t = LAP_TIME - (HISTORY + HZ * 3) / HZ;
  for (let i = 0; i < HISTORY + HZ * 3; i++) {
    compute(1 / HZ);
    for (const k of keys) history[k][sim.head] = state[k];
    sim.head = (sim.head + 1) % HISTORY;
  }
  return sim;
}

/** Stylised circuit outline (unit square) for the mini map; phase 0 is the start/finish line. */
export const TRACK_OUTLINE = [
  [0.08, 0.62], [0.2, 0.62], [0.42, 0.62], [0.62, 0.62], [0.78, 0.6], [0.9, 0.5], [0.92, 0.34],
  [0.84, 0.22], [0.7, 0.26], [0.62, 0.38], [0.52, 0.3], [0.46, 0.14], [0.34, 0.1], [0.24, 0.18],
  [0.2, 0.32], [0.12, 0.38], [0.06, 0.5],
];
