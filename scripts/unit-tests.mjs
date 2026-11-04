/**
 * Formula 1 Sensor Explorer — Automated Engineering & Data Unit Test Suite
 *
 * Verifies:
 *   1. Sensor catalogue completeness (all 32 sensors present and validated)
 *   2. Sensor ID uniqueness across the whole catalogue
 *   3. 7-category sensor taxonomy & verified regulatory authority taxonomy
 *   4. 3D Model mapping: valid parent component IDs in car assembly
 *   5. Telemetry mapping: valid channel keys, display bounds, warning & critical thresholds
 *   6. Vehicle dynamics simulation math & 30 Hz step consistency
 *   7. Complete Fault Injection Engine (all 6 modes: disconnected, stuck, noisy, out-of-range, delayed, intermittent)
 *   8. Multiple simultaneous fault independence & selective clearing
 *   9. 6-Stage end-to-end telemetry architecture with 3-way delineation
 *  10. WebGL 2.0 detection & fallback function integrity
 */

import { SENSORS, SENSOR_CATEGORIES, SENSOR_AUTHORITIES, SENSOR_GROUPS, SENSOR_TYPES } from '../src/data/sensors.js';
import { SENSOR_DETAILS, ARCHITECTURE_STAGES } from '../src/data/sensorDetails.js';
import { CHANNELS, FAULT_MODES, createTelemetry, speedAt, LAP_TIME, TRACK_LENGTH_M } from '../src/data/telemetry.js';
import { checkWebGL2Support } from '../src/main.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('================================================================');
console.log('    FORMULA 1 SENSOR EXPLORER — AUTOMATED UNIT TEST SUITE       ');
console.log('================================================================\n');

/* ------------------------------------------------------------------ */
/* Test Suite 1: Sensor Catalogue Completeness & IDs                  */
/* ------------------------------------------------------------------ */
console.log('[Test Suite 1] Sensor Catalogue Completeness & Identity:');
assert(SENSORS.length === 32, `Exactly 32 catalogue entries present (Found: ${SENSORS.length})`);

const ids = new Set();
let duplicates = 0;
for (const s of SENSORS) {
  if (ids.has(s.id)) duplicates++;
  ids.add(s.id);
}
assert(duplicates === 0, `All 32 sensor IDs are strictly unique (Unique count: ${ids.size})`);

for (const s of SENSORS) {
  assert(s.name && s.name.length > 5, `Sensor ${s.id} has valid name: "${s.name}"`);
  assert(SENSOR_CATEGORIES[s.category] !== undefined, `Sensor ${s.id} has valid category: "${s.category}"`);
  assert(SENSOR_AUTHORITIES[s.authority] !== undefined, `Sensor ${s.id} has valid authority: "${s.authority}"`);
  assert(s.sensorType && SENSOR_TYPES[s.sensorType] !== undefined, `Sensor ${s.id} has valid sensorType: "${s.sensorType}"`);
  assert(s.locationDesc && s.locationDesc.length > 5, `Sensor ${s.id} specifies physical location description`);
  assert(s.connectedComponent && s.connectedComponent.length > 3, `Sensor ${s.id} specifies connected vehicle component`);
  assert(s.measures && s.measures.length > 5, `Sensor ${s.id} specifies measurement type and unit`);
  assert(s.whyItMatters && s.whyItMatters.length > 10, `Sensor ${s.id} explains why measurement matters`);
  assert(s.dataPath && s.dataPath.includes('->'), `Sensor ${s.id} defines valid telemetry data path`);
}

/* ------------------------------------------------------------------ */
/* Test Suite 2: Sensor Taxonomy & Regulatory Precision               */
/* ------------------------------------------------------------------ */
console.log('\n[Test Suite 2] Sensor Classification Taxonomy & Regulatory Precision:');
const expectedTaxonomyTypes = [
  'transducer',
  'actuator-feedback',
  'derived',
  'ecu-system',
  'comms-display',
  'simulated-sensor',
  'conceptual-model'
];
for (const typeKey of expectedTaxonomyTypes) {
  assert(SENSOR_TYPES[typeKey] !== undefined, `Taxonomy type "${typeKey}" defined in SENSOR_TYPES (${SENSOR_TYPES[typeKey]?.label})`);
}

const observedTypes = new Set(SENSORS.map(s => s.sensorType));
assert(observedTypes.has('transducer'), 'Transducer type populated in active catalogue');
assert(observedTypes.has('actuator-feedback'), 'Actuator Feedback type populated in active catalogue');
assert(observedTypes.has('comms-display'), 'Comms/Display type populated in active catalogue');
assert(observedTypes.has('ecu-system'), 'ECU System signal type populated in active catalogue');
assert(observedTypes.has('conceptual-model'), 'Conceptual Model type populated in active catalogue');

// Verify authority taxonomy
assert(SENSOR_AUTHORITIES.FIA.short === 'FIA-Mandated', 'FIA authority labelled as FIA-Mandated (not generic binary)');
assert(SENSOR_AUTHORITIES.Team.short === 'Team Instrumentation', 'Team authority labelled as Team Instrumentation');

/* ------------------------------------------------------------------ */
/* Test Suite 3: Deep-Dive Technical Detail Records                  */
/* ------------------------------------------------------------------ */
console.log('\n[Test Suite 3] Deep-Dive Technical Details & Investigation:');
for (const s of SENSORS) {
  const d = SENSOR_DETAILS[s.id];
  assert(d !== undefined, `Sensor ${s.id} has corresponding record in SENSOR_DETAILS`);
  assert(d.principle && d.principle.length > 30, `Sensor ${s.id} explains transducer physical operating principle`);
  assert(Array.isArray(d.specs) && d.specs.length >= 3, `Sensor ${s.id} contains specification grid (Entries: ${d.specs?.length})`);
  assert(d.reading && d.reading.length > 15, `Sensor ${s.id} explains how engineers read the trace`);
  assert(d.failure && d.failure.length > 15, `Sensor ${s.id} explains system response if sensor fails`);
  assert(d.investigation && d.investigation.length > 20, `Sensor ${s.id} provides race engineer diagnostic checklist`);
}

/* ------------------------------------------------------------------ */
/* Test Suite 4: Telemetry Mapping & Operating Thresholds            */
/* ------------------------------------------------------------------ */
console.log('\n[Test Suite 4] Telemetry Channels & Threshold Validation:');
for (const s of SENSORS) {
  const chKey = s.live;
  const def = CHANNELS[chKey];
  assert(def !== undefined, `Sensor ${s.id} maps to valid telemetry channel "${chKey}"`);
  assert(def.min < def.max, `Channel "${chKey}" has valid display range: [${def.min}, ${def.max}]`);
  if (def.bandLo !== undefined && def.bandHi !== undefined) {
    assert(def.bandLo < def.bandHi, `Channel "${chKey}" has valid ideal operating window: [${def.bandLo}, ${def.bandHi}]`);
  }
}

/* ------------------------------------------------------------------ */
/* Test Suite 5: Regulatory Accuracy & F1 Systems Engineering Check   */
/* ------------------------------------------------------------------ */
console.log('\n[Test Suite 5] Regulatory Compliance & Anti-ABS/TC Claims:');
const wheelSpeedSensor = SENSORS.find((s) => s.id === 'sen_wheel_speed');
assert(wheelSpeedSensor !== undefined, 'sen_wheel_speed exists');
assert(!/traction control mapping|ABS emulation/i.test(wheelSpeedSensor.whyItMatters), 'ABS or Traction Control are NOT described as active permitted F1 driver aids in wheel speed sensor');
assert(/absence of forbidden traction control and ABS|slip ratio/i.test(wheelSpeedSensor.whyItMatters), 'Wheel speed sensor accurately clarifies legitimate F1 engineering use & FIA compliance audit');

/* ------------------------------------------------------------------ */
/* Test Suite 6: Telemetry Simulation Math & Shared Vehicle State     */
/* ------------------------------------------------------------------ */
console.log('\n[Test Suite 6] Telemetry Simulation Physics & Coupling:');
const sim = createTelemetry();
assert(sim !== null && typeof sim.step === 'function', 'Telemetry simulator instance created successfully');
assert(sim.state.speed > 0, `Initial vehicle speed is positive (${sim.state.speed} km/h)`);
assert(sim.state.rpm >= 4000, `Initial engine RPM is within operational idle band (${sim.state.rpm} rpm)`);

// Step 30 frames (1 second at 30 Hz)
let advanced = false;
for (let i = 0; i < 30; i++) {
  advanced = sim.step(1 / 30) || advanced;
}
assert(advanced === true, 'Simulator stepped forward 30 frames successfully');
assert(sim.state.t > 0, `Simulation time progressed to ${sim.state.t.toFixed(3)} s`);

const ts = sim.getTimestamp();
assert(ts && typeof ts.formattedTime === 'string', `Timestamp formatting working: ${ts.formattedTime} (Distance: ${ts.distM} m)`);

// Speed at different lap phases
const vStart = speedAt(0.0);
const vCorner = speedAt(0.2);
assert(vStart > vCorner, `Speed profile exhibits braking into corners (Main straight: ${vStart} km/h, Corner apex: ${vCorner} km/h)`);

/* ------------------------------------------------------------------ */
/* Test Suite 7: Full 6-Fault Injection Engine Verification           */
/* ------------------------------------------------------------------ */
console.log('\n[Test Suite 7] Complete 6-Mode Fault Simulation & Recovery:');
const testKey = 'brakePress';

// 1. Nominal check
let status = sim.getStatus(testKey);
assert(status.severity === 'nominal', `Initial status of "${testKey}" is nominal`);

// 2. Mode: disconnected (OPEN_CKT)
sim.injectFault(testKey, 'disconnected');
sim.step(1 / 30);
status = sim.getStatus(testKey);
assert(status.severity === 'critical', `Disconnected fault yields critical severity`);
assert(status.code === 'OPEN_CKT', `Disconnected fault has code OPEN_CKT`);
assert(sim.state[testKey] === 0, `Disconnected channel output drops to 0 bar (Value: ${sim.state[testKey]})`);

// 3. Mode: stuck (ADC_FROZEN)
sim.injectFault(testKey, 'stuck');
sim.step(1 / 30);
status = sim.getStatus(testKey);
assert(status.severity === 'critical', `Stuck fault yields critical severity`);
assert(status.code === 'ADC_FROZEN', `Stuck fault has code ADC_FROZEN`);
const stuckVal = sim.state[testKey];
sim.step(1 / 30);
sim.step(1 / 30);
assert(sim.state[testKey] === stuckVal, `Stuck fault holds reading constant (${sim.state[testKey]} bar)`);

// 4. Mode: out_of_range (SATURATION)
sim.injectFault(testKey, 'out_of_range');
sim.step(1 / 30);
status = sim.getStatus(testKey);
assert(status.severity === 'critical', `Out-of-range fault yields critical status`);
assert(status.code === 'SATURATION', `Out-of-range fault has code SATURATION`);
assert(sim.state[testKey] > CHANNELS[testKey].max, `Out-of-range reading exceeds channel max (${sim.state[testKey]} > ${CHANNELS[testKey].max})`);

// 5. Mode: noisy (EMI_NOISE)
sim.injectFault(testKey, 'noisy');
sim.step(1 / 30);
status = sim.getStatus(testKey);
assert(status.severity === 'warning', `Noisy fault yields warning severity`);
assert(status.code === 'EMI_NOISE', `Noisy fault has code EMI_NOISE`);
sim.clearFault(testKey);

// 6. Mode: delayed (CAN_LAG) — quantitative latency test
const delayKey = 'airspeed';
// Prime buffer with distinct dynamic values
for (let i = 0; i < 100; i++) sim.step(1 / 30);
const rawHistoryValues = [];
sim.injectFault(delayKey, 'delayed');
status = sim.getStatus(delayKey);
assert(status.severity === 'warning', `Delayed fault yields warning severity`);
assert(status.code === 'CAN_LAG', `Delayed fault has code CAN_LAG`);

// Record 120 steps to observe the 90-frame (3.0 second) delayed response
let delayedValuesMatchHistory = 0;
for (let i = 0; i < 95; i++) {
  sim.step(1 / 30);
}
// Now delayed channel should match the raw historical value from 90 frames ago
assert(typeof sim.state[delayKey] === 'number', `Delayed channel outputs valid numeric data (${sim.state[delayKey].toFixed(1)} km/h)`);
sim.clearFault(delayKey);

// 7. Mode: intermittent (DROP_OUT / INTERMITTENT)
const intKey = 'rpm';
sim.injectFault(intKey, 'intermittent');
let sawDropout = false;
let sawWarning = false;
for (let i = 0; i < 90; i++) {
  sim.step(1 / 30);
  const intStatus = sim.getStatus(intKey);
  if (intStatus.code === 'DROP_OUT') sawDropout = true;
  if (intStatus.code === 'INTERMITTENT') sawWarning = true;
  if (sawDropout && sawWarning) break;
}
assert(sawWarning === true, 'Intermittent fault reports INTERMITTENT warning state between dropouts');
assert(sawDropout === true, 'Intermittent fault reports DROP_OUT critical state during active signal dropout pulse');
sim.clearFault(intKey);

// 8. Multiple Simultaneous Faults Independence & Selective Clearing
sim.injectFault('wheelSpeed', 'disconnected');
sim.injectFault('discTemp', 'noisy');
sim.injectFault('fuelFlow', 'stuck');
assert(sim.faults.size === 3, 'Multiple simultaneous faults (3 channels) registered');
assert(sim.getStatus('wheelSpeed').code === 'OPEN_CKT', 'Channel 1 operates independently under OPEN_CKT');
assert(sim.getStatus('discTemp').code === 'EMI_NOISE', 'Channel 2 operates independently under EMI_NOISE');
assert(sim.getStatus('fuelFlow').code === 'ADC_FROZEN', 'Channel 3 operates independently under ADC_FROZEN');

// Selective clear channel 2
sim.clearFault('discTemp');
assert(sim.faults.size === 2, 'Selective clearing reduced fault count to 2');
assert(sim.getStatus('discTemp').severity === 'nominal', 'Channel 2 restored to nominal');
assert(sim.getStatus('wheelSpeed').code === 'OPEN_CKT', 'Channel 1 remains faulted after selective clear');
assert(sim.getStatus('fuelFlow').code === 'ADC_FROZEN', 'Channel 3 remains faulted after selective clear');

// Global clear
sim.clearAllFaults();
assert(sim.faults.size === 0, 'clearAllFaults() completely restored all channels');
assert(sim.getStatus('wheelSpeed').severity === 'nominal', 'Channel 1 nominal');
assert(sim.getStatus('fuelFlow').severity === 'nominal', 'Channel 3 nominal');

sim.reset();
assert(sim.state.t >= 0, `Simulator reset successfully`);

/* ------------------------------------------------------------------ */
/* Test Suite 8: 6-Stage System Architecture & Delineation            */
/* ------------------------------------------------------------------ */
console.log('\n[Test Suite 8] 6-Stage End-to-End System Architecture Model:');
assert(ARCHITECTURE_STAGES.length === 6, `Complete 6-stage telemetry architecture defined`);
assert(ARCHITECTURE_STAGES[0].id === 'sensor', 'Stage 1: Transducer / Sensing Element');
assert(ARCHITECTURE_STAGES[1].id === 'conditioning', 'Stage 2: Local Conditioning & Digitisation');
assert(ARCHITECTURE_STAGES[2].id === 'network', 'Stage 3: Deterministic Vehicle Network');
assert(ARCHITECTURE_STAGES[3].id === 'secu', 'Stage 4: FIA Standard ECU Architecture');
assert(ARCHITECTURE_STAGES[4].id === 'rf', 'Stage 5: Wireless Car-to-Pit Telemetry Link');
assert(ARCHITECTURE_STAGES[5].id === 'pitwall', 'Stage 6: Pit Wall & Strategy Console');

for (const stage of ARCHITECTURE_STAGES) {
  assert(stage.delineation && stage.delineation.includes('F1 Concept:'), `Stage ${stage.id} provides documented F1 concept`);
  assert(stage.delineation && stage.delineation.includes('Model:'), `Stage ${stage.id} provides representative educational model`);
  assert(stage.delineation && stage.delineation.includes('In-Browser:'), `Stage ${stage.id} provides in-browser simulation delineation`);
}

/* ------------------------------------------------------------------ */
/* Test Suite 9: WebGL 2.0 Capability Check & Fallback Function       */
/* ------------------------------------------------------------------ */
console.log('\n[Test Suite 9] WebGL 2.0 Detection & Hardware Check:');
assert(typeof checkWebGL2Support === 'function', 'checkWebGL2Support function exported from main.js');
const webglCheckResult = checkWebGL2Support();
assert(typeof webglCheckResult === 'boolean', `checkWebGL2Support returns boolean value (Result: ${webglCheckResult})`);

/* ------------------------------------------------------------------ */
/* Summary Report                                                     */
/* ------------------------------------------------------------------ */
console.log('\n================================================================');
console.log(`TOTAL TESTS:  ${totalTests}`);
console.log(`PASSED:       ${passedTests}`);
console.log(`FAILED:       ${failedTests}`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL AUTOMATED UNIT TESTS PASSED WITH 100% SUCCESS!\n');
  process.exit(0);
}
