/**
 * Formula 1 Sensor Explorer — Deep-Dive Engineering Data Content.
 *
 * Detailed engineering records for all 32 motorsport telemetry channels,
 * merged into the SENSORS catalogue in `sensors.js`.
 *
 * Each record provides:
 *   group         - Subsystem grouping (wheels, brakes, aero, chassis, driver, engine, hybrid, comms)
 *   live          - Simulated telemetry channel key in `telemetry.js`
 *   fx            - 3D visual effect: pulse | laser | ir | airflow | rf
 *   hz            - Representative sampling frequency in Hz
 *   plain         - Plain-English intuitive comparison
 *   principle     - Technical physics of the measurement transducer
 *   specs         - Representative engineering specifications grid
 *   reading       - How race engineers interpret the trace
 *   failure       - Vehicle/system impact if sensor fails
 *   investigation - Race engineer step-by-step diagnostic investigation checklist
 *   notes         - Stage-by-stage explanation notes for the 6-stage telemetry path
 */

export const SENSOR_GROUPS = [
  { id: 'wheels', label: 'Wheels & Tyres', blurb: 'Traction interface and tyre thermodynamics.' },
  { id: 'brakes', label: 'Brakes & Suspension', blurb: 'Braking force balance and chassis load dynamics.' },
  { id: 'aero', label: 'Aero & Airflow', blurb: 'Aerodynamic pressure, downforce, and active wing angles.' },
  { id: 'chassis', label: 'Chassis & Safety', blurb: 'Kinematic accelerations, crash data, and track timing.' },
  { id: 'driver', label: 'Driver & Cockpit', blurb: 'Driver control inputs, physiological telemetry, and FIA flags.' },
  { id: 'engine', label: 'Engine & Fuel', blurb: 'Combustion pressures, temperatures, fuel limits, and turbo speed.' },
  { id: 'hybrid', label: 'Hybrid & Drivetrain', blurb: 'MGU-K 350 kW deploy/regen, high-voltage battery, and driveshaft torque.' },
  { id: 'comms', label: 'Electronics & Telemetry', blurb: 'SECU central brain, bus architecture, and car-to-pit radio links.' },
];

/* 6-Stage End-to-End Motorsport IoT Architecture Model */
export const ARCHITECTURE_STAGES = [
  {
    id: 'sensor',
    label: 'Stage 1: Transducer / Sensing Element',
    type: 'Physical / Virtual',
    desc: 'Representative physical sensor measurement (piezoresistive, optical, strain-gauge, RTD) or virtual state estimation.',
    delineation: 'F1 Concept: Direct transducer contact or optical pickup. Model: Physics-based parameters in telemetry.js. In-Browser: 30 Hz numerical simulation loop.',
  },
  {
    id: 'conditioning',
    label: 'Stage 2: Local Conditioning & Digitisation',
    type: 'Local Conditioning',
    desc: 'Differential amplification, anti-alias hardware filtering, and analog-to-digital conversion in local sub-nodes.',
    delineation: 'F1 Concept: Aerospace-grade signal conditioning ASICs. Model: Calibrated transfer functions with noise/jitter. In-Browser: Floating-point conversion.',
  },
  {
    id: 'network',
    label: 'Stage 3: Deterministic Vehicle Network',
    type: 'Bus Architecture',
    desc: 'Deterministic CAN / CAN-FD or Automotive Ethernet sub-network carrying prioritized telemetry frames.',
    delineation: 'F1 Concept: Time-triggered aerospace CAN-FD buses. Model: Frame-rate message routing with latency/jitter. In-Browser: Ring-buffer state queues.',
  },
  {
    id: 'secu',
    label: 'Stage 4: FIA Standard ECU Architecture',
    type: 'Central Compute Hub',
    desc: 'Standardized central processing hub running FIA-certified control laws, safety checks, and official scrutineering logging.',
    delineation: 'F1 Concept: McLaren Applied TAG-320 running standard FIA software. Model: Closed-loop powertrain and BBW simulation. In-Browser: JavaScript event and state loops.',
  },
  {
    id: 'rf',
    label: 'Stage 5: Wireless Car-to-Pit Telemetry Link',
    type: 'RF Telemetry',
    desc: 'Bidirectional wireless microwave RF telemetry streaming vehicle health and performance data to trackside antennas.',
    delineation: 'F1 Concept: Encrypted UHF/microwave link with burst repeaters. Model: RSSI attenuation and packet drop simulation. In-Browser: Real-time UI data piping.',
  },
  {
    id: 'pitwall',
    label: 'Stage 6: Pit Wall & Strategy Console',
    type: 'Engineering Interface',
    desc: 'Trackside telemetry analysis console displaying real-time waveforms, alarm thresholds, and strategy algorithms.',
    delineation: 'F1 Concept: Trackside ATLAS analysis software. Model: Interactive oscilloscope and live HUD. In-Browser: SVG scopes, WebGL rendering and DOM UI.',
  },
];

/* Stage notes matched by keyword */
const NODE_NOTES = [
  [/SECU|ECU|TAG-320/i, 'FIA Standard ECU concept (McLaren Applied TAG-320 architecture). Central vehicle computer executing FIA-audited control software and logging scrutineering data (represented in this simulation by central telemetry state management).'],
  [/CAN|CAN-FD|bus/i, 'Deterministic CAN / CAN-FD or Automotive Ethernet bus protocol concept. Carries prioritized arbitration IDs with hardware CRC error detection (simulated via message queues).'],
  [/RF|433|radio|BLE|wireless|Bluetooth/i, 'Short-range wireless hop concept (433 MHz rim link, 2.4 GHz driver glove BLE) bridging rotating or wearable components without slip rings.'],
  [/harness|loom|sub-loom/i, 'Shielded aerospace Raychem wiring loom concept. Twisted shielded pairs isolate signals from high-voltage hybrid EMI.'],
  [/analog|analogue|0-5V|SPI|serial/i, 'Low-latency analog/SPI connection concept providing direct signal response to local acquisition nodes.'],
  [/telemetry|logger|broadcast|transmitter|trackside/i, 'Live car-to-pit wireless telemetry stream concept, broadcasting vehicle dynamics parameters to trackside engineering stations.'],
  [/amplifier|transducer|conditioner|counter|inverter|ASIC|MCU|node/i, 'Front-end signal conditioning node concept. Filters electrical noise and amplifies micro-volt signals into calibrated digital parameters.'],
];

export function explainStage(label, custom) {
  if (custom) return custom;
  for (const [re, text] of NODE_NOTES) if (re.test(label)) return text;
  return 'A dedicated signal conditioning or communication stage processing and relaying sensor telemetry to the central vehicle network.';
}

export const SENSOR_DETAILS = {
  /* ---------------- wheels & tyres ---------------- */
  sen_wheel_speed: {
    group: 'wheels', live: 'wheelSpeed', fx: 'pulse', hz: 1000,
    plain: 'A high-precision optical speedometer reading wheel rotation 1,000 times a second on every hub.',
    principle: 'A toothed ferrous tone ring spins with the wheel hub. A variable reluctance or optical Hall pickup senses tooth passing frequencies. Comparing rotational velocities across all four corners yields instantaneous wheel slip ratios. Note: Conventional ABS and traction control are banned in F1; this data drives Brake-by-Wire rear migration, differential ramp locks, and FIA compliance audits.',
    specs: [['Measurement Range', '0–290 rad/s (0–355 km/h)'], ['Sampling Rate', '1,000 Hz (1 kHz)'], ['Sensor Technology', 'Hall-effect / Optical pickup'], ['Output Protocol', 'Digital pulse train to CAN-FD node'], ['Operating Temp', '–40 °C to +180 °C']],
    reading: 'Front wheel lockup appears as a sudden plunge toward zero under braking. Rear wheelspin appears as a sharp positive divergence above true vehicle ground speed on corner exit.',
    failure: 'The SECU loses wheel slip estimation and falls back to safe open-loop differential and passive brake bias tables. The car becomes sluggish and prone to tyre flat-spotting.',
    investigation: '1. Cross-check speed against remaining 3 wheels and GPS ground speed. 2. If single wheel locks, inspect caliper piston seal rollback. 3. If reading is zero or noisy, check tone ring tooth clearance (0.75 mm ± 0.1 mm) and wiring harness continuity.',
    notes: ['Counts tooth passes on hub tone ring with microsecond accuracy.', 'Shielded harness runs up carbon wishbone channel to chassis node.'],
  },
  sen_tpms: {
    group: 'wheels', live: 'tpms', fx: 'rf', hz: 10,
    plain: 'An internal pressure and temperature monitor mounted inside the wheel rim, communicating by radio.',
    principle: 'A micromachined piezoresistive silicon pressure transducer and thermistor reside inside the magnesium wheel rim. Because the wheel rotates up to 2,800 rpm, signals are transmitted wirelessly over a 433 MHz RF link to an antenna receiver mounted in the upright assembly.',
    specs: [['Pressure Range', '1.0 to 3.0 bar absolute'], ['Temperature Range', '–20 °C to +150 °C'], ['RF Carrier', '433.92 MHz encrypted'], ['Accuracy', '± 0.01 bar / ± 1.0 °C'], ['Sampling Rate', '10 Hz (nominal)']],
    reading: 'Tyre cavity pressure gradually builds by 0.2–0.4 bar as carcass temperature rises. A rapid downward step in pressure indicates a puncture or rim bead unseating.',
    failure: 'Real-time structural tyre monitoring is lost. The team cannot verify compliance with Pirelli mandatory minimum running pressures and must box the car immediately.',
    investigation: '1. Determine if pressure loss is rapid (> 0.15 bar/lap = puncture) or slow (bead seepage). 2. Check wheel receiver signal strength (RSSI). 3. If zero reading, replace TPMS rim transmitter battery or check upright receiver antenna.',
    notes: ['Piezoresistive diaphragm inside rim air chamber.', '433 MHz RF transmission across wheel rotation gap to upright receiver.'],
  },
  sen_tyre_ir: {
    group: 'wheels', live: 'tyreSurf', fx: 'ir', hz: 100,
    plain: 'An infrared thermal camera pointed at the tyre tread, measuring inner, centre, and outer shoulder temperatures without touching the rubber.',
    principle: 'Thermopile optical elements collect radiated blackbody infrared emissions from the spinning tyre tread. Spectral filtering across multiple optical channels measures separate temperature zones across the tyre width.',
    specs: [['Thermal Range', '0 °C to +200 °C'], ['Optical Channels', '3–8 zones across tread'], ['Spectral Response', '8 to 14 µm (LWIR)'], ['Response Time', '< 8 ms'], ['Sampling Rate', '100 Hz']],
    reading: 'A high inner-shoulder temperature indicates excessive static negative camber. A hot centre zone indicates over-inflation. Engineers tune pressures and suspension geometry to achieve uniform temperature distribution across the contact patch.',
    failure: 'Tyre thermal degradation mapping is lost. Trackside engineers cannot predict tyre blistering, graining, or optimal pit window timings accurately.',
    investigation: '1. Clean optical lens on brake duct from tyre rubber marbling and brake dust. 2. Verify sensor aiming angle relative to wheel steer travel. 3. Check CAN bus node calibration for thermal drift.',
  },

  /* ---------------- brakes & suspension ---------------- */
  sen_brake_disc_temp: {
    group: 'brakes', live: 'discTemp', fx: 'ir', hz: 100,
    plain: 'A high-temperature infrared pyrometer monitoring the glowing carbon brake disc up to 1,200 °C.',
    principle: 'Carbon-carbon friction rings radiate intense infrared energy when braked from 340 km/h. A non-contact optical pyrometer housing an InGaAs or thermopile detector monitors radiation through a protected lens inside the brake cooling duct.',
    specs: [['Measurement Range', '150 °C to 1,200 °C'], ['Ideal Window', '400 °C to 850 °C'], ['Critical Limit', '1,050 °C (oxidation risk)'], ['Sampling Rate', '100 Hz'], ['Response Time', '< 5 ms']],
    reading: 'Disc temperature spikes sharply in braking zones (climbing by 500 °C in < 2 seconds) and cools along the straights. Operating below 350 °C causes brake bite inconsistency; exceeding 950 °C accelerates carbon oxidation wear.',
    failure: 'Brake thermal management is compromised. The team may be forced to enlarge brake duct openings, sacrificing aerodynamic downforce to avoid catastrophic disc failure.',
    investigation: '1. Compare left vs right axle disc temperatures; a > 120 °C split indicates caliper dragging or duct debris block. 2. Inspect carbon disc friction faces for oxidation pitting. 3. Verify pyrometer lens cleanliness.',
  },
  sen_brake_pressure: {
    group: 'brakes', live: 'brakePress', fx: 'pulse', hz: 1000,
    plain: 'A high-frequency hydraulic pressure sensor measuring exactly how hard the driver presses the brake pedal.',
    principle: 'Hydraulic fluid acts upon a thin stainless-steel diaphragm bonded with piezoresistive strain gauges. Fluid pressure deflects the diaphragm by micrometers, unbalancing a Wheatstone bridge into an analog voltage proportional to line pressure.',
    specs: [['Pressure Range', '0 to 200 bar'], ['Burst Pressure', '> 450 bar'], ['Sampling Frequency', '1,000 Hz (1 kHz)'], ['Accuracy', '± 0.2 % Full Scale'], ['Excitation Voltage', '5.0 V regulated']],
    reading: 'Displays a steep initial rise representing the driver\'s initial brake hit (up to 120+ bar), followed by a smooth exponential trailing release as downforce bleeds off toward corner turn-in.',
    failure: 'The electronic Brake-by-Wire (BBW) system detects a channel discrepancy and drops into a hydraulic backup mode with fixed mechanical bias, lengthening stopping distances.',
    investigation: '1. Verify front and rear circuit pressure delta. 2. Bleed hydraulic lines for trapped air compressibility. 3. Test sensor 5V excitation voltage and output signal wire for pin pushout.',
  },
  sen_pushrod_load: {
    group: 'brakes', live: 'pushrod', fx: 'pulse', hz: 500,
    plain: 'A precision strain-gauge load cell built into the suspension pushrod, weighing the car\'s downforce in real time.',
    principle: 'Full-bridge foil strain gauges are bonded inside the titanium or carbon suspension pushrod. Tension and compression axial loads cause minute resistance changes, amplified by an integrated instrumentation amplifier into a calibrated force output.',
    specs: [['Load Range', '–5 kN to +18 kN'], ['Sampling Rate', '500 Hz'], ['Bridge Resistance', '1,000 Ohm full bridge'], ['Thermal Compensation', '–20 °C to +120 °C'], ['Resolution', '< 5 N']],
    reading: 'Force scales quadratically with speed as aerodynamic downforce pushes the car into the track. High-frequency spikes identify kerb strikes; roll differences reveal dynamic weight transfer.',
    failure: 'Aerodynamicists lose their primary on-track downforce validation data. Simulation-to-track correlation must rely on indirect damper potentiometer calculations.',
    investigation: '1. Check bridge zero-load offset calibration. 2. Inspect pushrod end spherical bearings for binding or play. 3. Check load cell amplifier wiring for water ingress or shield degradation.',
  },
  sen_damper_pos: {
    group: 'brakes', live: 'damper', fx: 'pulse', hz: 1000,
    plain: 'A high-speed linear potentiometer tracking suspension movement down to fractions of a millimetre.',
    principle: 'A conductive plastic wiper slides along a precision resistive track as the damper compresses and rebounds. Differentiating damper position with respect to time yields instantaneous suspension velocities (m/s).',
    specs: [['Stroke Range', '0 to 75 mm'], ['Sampling Frequency', '1,000 Hz (1 kHz)'], ['Linearity', '± 0.1 % Full Scale'], ['Life Rating', '> 25 million cycles'], ['Output', '0.5 V to 4.5 V analog']],
    reading: 'Velocity histograms classify damping into low-speed (< 25 mm/s, driver body roll/pitch) and high-speed (> 100 mm/s, kerbs and bumps) regimes, directing suspension clicker adjustments.',
    failure: 'Chassis dynamics engineering loses pitch/roll platform displacement tracking. The car\'s aerodynamic ride height control cannot be properly tuned.',
    investigation: '1. Verify mechanical slider rod is straight and free of road grit binding. 2. Check full-bump and full-droop voltage calibration limits. 3. Inspect harness lead at suspension hinge point for fatigue cracking.',
  },
  sen_ride_height: {
    group: 'brakes', live: 'rideHeight', fx: 'laser', hz: 500,
    plain: 'An optical triangulation laser measuring ground clearance between the underfloor and the road hundreds of times a second.',
    principle: 'A solid-state laser diode projects a collimated beam onto the asphalt. Diffuse reflected light passes through a receiver lens onto a linear CMOS or Position Sensitive Detector (PSD). Geometric optical triangulation determines distance independent of surface reflectivity.',
    specs: [['Measurement Range', '5 to 50 mm'], ['Sampling Rate', '500 Hz'], ['Resolution', '0.05 mm'], ['Laser Wavelength', '650 nm (Class 2)'], ['Output Interface', 'High-speed RS-485 / CAN']],
    reading: 'Shows the floor sucking down closer to the asphalt as speed builds. Ground-effect aerodynamic efficiency peaks at minimum ride height, but bottoming wears the mandatory legality skid plank.',
    failure: 'Engineers must raise the car\'s static ride height by 4–8 mm as a safety margin, sacrificing substantial underbody downforce to prevent plank wear penalties.',
    investigation: '1. Clean optical quartz protective window on the nose/keel underbody. 2. Verify laser zero-reference plane against a flat setup plate. 3. Inspect sensor mounting bracket for vibration loosening.',
  },
  sen_steer_angle_torque: {
    group: 'driver', live: 'steer', fx: 'pulse', hz: 1000,
    plain: 'An optical encoder and torsion strain cell measuring steering angle and driver effort on the wheel.',
    principle: 'A dual-channel optical disc encoder tracks handwheel angular displacement. A calibrated torsion spring section instrumented with strain gauges measures the mechanical twisting torque exerted by the driver\'s hands.',
    specs: [['Angle Range', '± 180°'], ['Torque Range', '± 35 Nm'], ['Angle Resolution', '< 0.05°'], ['Sampling Rate', '1,000 Hz'], ['Redundancy', 'Dual redundant optical pickups']],
    reading: 'Comparing steering handwheel angle with lateral acceleration exposes understeer (additional steering input yielding no extra lateral g) and oversteer (counter-steering corrections at corner exit).',
    failure: 'Power-steering assistance drops into a fixed-effort fallback map. Active differential locking maps lose steering rate derivative terms, degrading turn-in agility.',
    investigation: '1. Verify optical disc encoder optical alignment. 2. Calibrate steering centre zero offset with wheels straight on setup pad. 3. Check torsion bridge excitation supply voltage.',
  },

  /* ---------------- aero ---------------- */
  sen_pitot_array: {
    group: 'aero', live: 'airspeed', fx: 'airflow', hz: 200,
    plain: 'A dynamic multi-port Pitot tube array measuring true airspeed, independent of tyre slip or wind gusts.',
    principle: 'A forward-facing stagnation port measures total pressure ($P_0$), while surrounding radial ports measure static atmospheric pressure ($P_s$). According to Bernoulli\'s equation, dynamic pressure $q = P_0 - P_s = \\frac{1}{2}\\rho v^2$, yielding true aerodynamic airspeed $v$. Auxiliary multi-hole ports measure aerodynamic yaw and pitch flow angles.',
    specs: [['Airspeed Range', '0 to 390 km/h'], ['Pressure Range', '0 to 10 kPa differential'], ['Sampling Rate', '200 Hz'], ['Flow Angle Range', '± 20° yaw / pitch'], ['Accuracy', '± 0.5 % Full Scale']],
    reading: 'Airspeed reading diverges from GPS speed in the presence of head/tailwinds. When following another car, a sudden dip in airspeed signifies the aerodynamic wake (slipstream / dirty air).',
    failure: 'True aerodynamic velocity tracking is lost. Aerodynamicists must estimate downforce from GPS speed, compromising aero efficiency calculations.',
    investigation: '1. Inspect nose probe tube orifice for insect or rubber debris blockage. 2. Check pneumatic silicone lines for moisture or pinch points. 3. Perform differential transducer zero-drift calibration.',
  },
  sen_active_aero_pos: {
    group: 'aero', live: 'aeroFlap', fx: 'pulse', hz: 1000,
    plain: 'A displacement sensor confirming that movable active aero flaps deploy cleanly between Corner Mode and Straight Mode.',
    principle: 'A Linear Variable Differential Transformer (LVDT) features a non-contact magnetic core moving inside primary and secondary transformer coils. Flap movement modulates mutual inductance, generating a linear AC voltage ratio that provides wear-free position sensing.',
    specs: [['Stroke Range', '0 to 35 mm (0° to 30° flap)'], ['Sampling Rate', '1,000 Hz (1 kHz)'], ['Linearity', '± 0.15 % Full Scale'], ['Actuation Time', '< 150 ms full transition'], ['Output', 'Demodulated analog to CAN']],
    reading: 'Displays rapid binary state transitions: low flap angle in Straight Mode (low drag on straights) and steep angle in Corner Mode (high downforce for cornering). Scrutineers audit transition timing.',
    failure: 'The SECU cannot confirm legal flap deployment. Under FIA regulations, the flaps are locked into the high-downforce Corner Mode, and the fault is transmitted to race control.',
    investigation: '1. Inspect hydraulic flap actuator pressure supply. 2. Verify LVDT core mechanical alignment and end-stop clearances. 3. Audit SECU driver card error registers for solenoid current faults.',
  },
  sen_wing_strain: {
    group: 'aero', live: 'wingStrain', fx: 'pulse', hz: 500,
    plain: 'Strain gauges laminated into the rear wing pylons measuring how much the wing bends under tons of downforce.',
    principle: 'Precision foil strain gauges are co-cured inside the structural carbon fibre pylon matrix. Downforce and drag exert bending and shear forces, causing microscopic carbon elongation that unbalances a Wheatstone bridge circuit.',
    specs: [['Strain Range', '0 to 3,000 µε (micro-strain)'], ['Equivalent Downforce', 'Up to 15 kN rear load'], ['Sampling Rate', '500 Hz'], ['Bridge Type', 'Full Wheatstone bridge'], ['Temperature Drift', 'Self-compensated']],
    reading: 'Strain rises continuously with speed squared, reaching maximum strain at the end of long straights. Comparing Straight Mode vs Corner Mode reveals the exact aerodynamic load reduction.',
    failure: 'Structural aeroelastic correlation is lost. Teams must increase structural safety factors on the rear wing assembly, adding unnecessary ballast.',
    investigation: '1. Inspect carbon pylon surface for micro-delamination or structural cracking. 2. Check strain amplifier gain resistor. 3. Re-zero static strain on setup pad.',
  },
  sen_ambient_probe: {
    group: 'aero', live: 'ambient', fx: 'pulse', hz: 10,
    plain: 'An airborne weather station measuring air temperature, barometric pressure, and humidity.',
    principle: 'A platinum RTD (PT100) measures temperature, a piezoresistive silicon diaphragm measures barometric pressure, and a capacitive polymer cell measures humidity. Together they yield continuous dry air density ($\rho$).',
    specs: [['Temperature Range', '–10 °C to +55 °C'], ['Pressure Range', '700 to 1,150 mbar'], ['Humidity Range', '0 to 100 % RH'], ['Sampling Rate', '10 Hz'], ['Accuracy', '± 0.2 °C / ± 1 mbar']],
    reading: 'High ambient temperature and low barometric pressure signify thin air, reducing radiator cooling capacity, engine oxygen mass flow, and total aerodynamic downforce.',
    failure: 'SECU air-density corrections fall back to stationary pit wall weather station telemetry, which lacks microclimate data from around the circuit.',
    investigation: '1. Inspect probe housing on roll hoop for debris obstruction. 2. Compare temperature with official FIA trackside weather stream. 3. Test sensor wiring loom connection.',
  },

  /* ---------------- chassis & safety ---------------- */
  sen_chassis_imu: {
    group: 'chassis', live: 'imu', fx: 'pulse', hz: 1000,
    plain: 'A 6-axis gyroscope and accelerometer tracking chassis acceleration and rotation rates in 3D space.',
    principle: 'Micro-Electro-Mechanical Systems (MEMS) accelerometers measure linear accelerations ($a_x, a_y, a_z$) via capacitive proof-mass displacement. Vibrating ring MEMS gyroscopes measure angular velocities (yaw, pitch, roll rates) via the Coriolis effect.',
    specs: [['Acceleration Range', '± 8 g (tri-axial)'], ['Angular Rate Range', '± 600 °/s (tri-axial)'], ['Sampling Rate', '1,000 Hz (1 kHz)'], ['Bandwidth', '0 to 250 Hz'], ['Bus Interface', 'High-speed SPI / CAN-FD']],
    reading: 'Lateral acceleration highlights maximum cornering grip (up to 5.0+ g in high-speed sweeps). Combining yaw rate with wheel speeds calculates vehicle chassis slip angle $\\beta$.',
    failure: 'The chassis state estimator fails. Dynamic differential control, slip angle observers, and active platform damping fall back to basic degraded modes.',
    investigation: '1. Check IMU mounting plate bolt torque (vibration resonance causes accelerometer saturation). 2. Verify SPI bus communication clock. 3. Re-zero gyro drift offsets while car is stationary.',
  },
  sen_adr_crash: {
    group: 'chassis', live: 'adrG', fx: 'pulse', hz: 1000,
    plain: 'The crash-hardened flight data recorder of the car, logging impacts up to 500 g for FIA safety analysis.',
    principle: 'Internal high-g piezoresistive and capacitive accelerometers monitor structural survival cell decelerations. The unit operates with its own internal capacitor/battery power reserve, writing pre- and post-impact data to solid-state non-volatile flash memory.',
    specs: [['Impact Range', 'Up to 500 g tri-axial'], ['Trigger Threshold', '15 g impact pulse'], ['Sampling Rate', '1,000 Hz to 20,000 Hz'], ['Memory Retention', '> 10 years unpowered'], ['Power', 'Independent internal backup battery']],
    reading: 'Normal racing vibrations remain below 2.5 g. Kerb strikes appear as short, sharp pulses under 7 g. Serious crash decelerations generate broad, sustained pulses exceeding 20+ g.',
    failure: 'The car is immediately disqualified from technical scrutineering. F1 technical regulations strictly prohibit running without an operational ADR unit.',
    investigation: '1. Connect official FIA ADR diagnostic download tool to survival cell umbilical. 2. Verify internal backup battery charge voltage. 3. Audit trigger flag registers.',
  },
  sen_gps_timing: {
    group: 'chassis', live: 'lapDist', fx: 'rf', hz: 20,
    plain: 'Centimetre-accurate satellite positioning combined with a track timing loop transponder.',
    principle: 'A multi-constellation GNSS antenna (GPS, GLONASS, Galileo) computes satellite carrier-phase position fixes. A subfloor inductive transponder communicates with underground timing loops embedded in the asphalt at sector splits.',
    specs: [['Position Accuracy', '10 to 30 cm (RTK corrected)'], ['Sampling Rate', '20 Hz'], ['Sector Timing', 'Loop-triggered (microsecond resolution)'], ['Interface', 'Encrypted serial to SECU']],
    reading: 'Drives lap distance tracking ($s$), official timing splits, and delta lap-time calculations against pole position reference laps. Also enforces Safety Car delta speeds.',
    failure: 'The car loses precise on-track GPS position. Live strategy tracking and automated Safety Car delta enforcement revert to fallback wheel-speed distance integration.',
    investigation: '1. Inspect GNSS antenna on forward nosecone for physical damage or carbon shielding. 2. Verify coaxial RF antenna lead connection. 3. Test inductive timing loop transponder power.',
  },

  /* ---------------- driver & cockpit ---------------- */
  sen_pedal_pos: {
    group: 'driver', live: 'throttle', fx: 'pulse', hz: 1000,
    plain: 'Dual redundant electronic throttle potentiometers ensuring the engine only accelerates when commanded.',
    principle: 'Dual independent conductive-plastic rotary potentiometers or Hall-effect angular sensors measure pedal pivot rotation. The SECU continuously cross-compares both signals ($V_1$ vs $V_2$); any discrepancy exceeding 2% triggers an instant safety power cut.',
    specs: [['Angular Range', '0° to 35° (0–100 % throttle)'], ['Redundancy', 'Dual galvanic isolated tracks'], ['Sampling Rate', '1,000 Hz'], ['Discrepancy Trip', '> 2.0 % delta for > 15 ms'], ['Excitation', 'Independent 5V rails']],
    reading: 'Displays driver throttle trace application: smooth throttle pick-up at apex, modulation through traction limits, and 100% full-throttle pinning along the straights.',
    failure: 'If track disagreement occurs, the SECU immediately clamps engine torque to idle/limp-home mode, preventing runaway throttle events.',
    investigation: '1. Cross-check Channel 1 vs Channel 2 voltage tracks across full pedal stroke. 2. Inspect pedal return spring mechanism. 3. Re-zero mechanical idle and full-throttle stops.',
  },
  sen_biometric_glove: {
    group: 'driver', live: 'heartRate', fx: 'rf', hz: 4,
    plain: 'Optical sensors embedded in the driver\'s racing glove streaming pulse rate and blood oxygen to the medical crew.',
    principle: 'An optical photoplethysmography (PPG) sensor illuminates dermal blood capillaries with dual-wavelength LEDs. Pulsatile blood volume changes modulate light absorption, extracting heart rate and blood oxygen saturation ($SpO_2$).',
    specs: [['Heart Rate Range', '40 to 220 bpm'], ['Oxygen Saturation', '70 to 100 % SpO2'], ['Wireless Link', 'Bluetooth Low Energy (2.4 GHz)'], ['Sampling Rate', '4 Hz'], ['Power', 'Micro flexible lithium cell']],
    reading: 'Driver heart rate typically averages 150–175 bpm during race conditions, surging past 190 bpm under severe braking, wheel-to-wheel battles, or high-stress moments.',
    failure: 'Trackside medical crews lose continuous physiological monitoring during accidents, relying instead on visual observations and voice radio communication.',
    investigation: '1. Verify glove BLE pairing with cockpit receiver. 2. Inspect glove optical sensor window for sweat or fabric misalignment. 3. Check battery charge status.',
  },
  sen_ear_accel: {
    group: 'driver', live: 'headG', fx: 'rf', hz: 1000,
    plain: 'Microscopic 3-axis accelerometers embedded in the driver\'s silicone earplugs measuring skull trauma.',
    principle: 'A sub-miniature tri-axial MEMS accelerometer package is cast inside the driver\'s custom-moulded radio earpiece. Resting inside the ear canal, it directly records skull kinematic accelerations during high-g crashes.',
    specs: [['Acceleration Range', '± 300 g (tri-axial)'], ['Sampling Rate', '1,000 Hz'], ['Package Mass', '< 2.5 grams total'], ['Bandwidth', '0 to 500 Hz'], ['Interface', 'Dedicated helmet wiring lead']],
    reading: 'Normal racing cornering subjects the driver\'s head to 2–4 g. Crash impacts generate rapid deceleration spikes; pulse duration and peak g guide medical concussion protocols.',
    failure: 'Post-crash medical diagnostics lose direct cranial acceleration records, requiring doctors to estimate trauma indirectly from chassis ADR records.',
    investigation: '1. Check earpiece miniature connector pins for contamination. 2. Verify helmet harness strain relief. 3. Confirm ADR earpiece channel recognition in hardware audit.',
  },
  sen_marshal_lights: {
    group: 'driver', live: 'flag', fx: 'rf', hz: 10,
    plain: 'Steering wheel warning display receiving official flag and Safety Car directives from race control.',
    principle: 'Trackside UHF radio loops broadcast encrypted race control flag status packets. The onboard receiver decodes commands and drives high-intensity RGB LED clusters on the steering wheel display and cockpit halo.',
    specs: [['Flag Modes', 'Green, Yellow, Double Yellow, Red, VSC, SC, Blue'], ['Communication', 'FIA encrypted trackside UHF'], ['Latency', '< 20 ms from race control trigger'], ['Display', 'Full-colour OLED / LED array']],
    reading: 'Changes state instantaneously when passing through incident sectors. Yellow flag signals require the driver to demonstrate a measurable speed reduction on telemetry.',
    failure: 'The driver must rely strictly on physical trackside marshal flags and team voice radio messages, increasing incident reaction times.',
    investigation: '1. Check cockpit UHF antenna coaxial connection. 2. Test steering wheel CAN communication bus. 3. Audit FIA telemetry flag acknowledge packets.',
  },

  /* ---------------- engine & fuel ---------------- */
  sen_crank_cam_rpm: {
    group: 'engine', live: 'rpm', fx: 'pulse', hz: 20000,
    plain: 'High-frequency Hall sensors reading teeth on the crankshaft to time spark and injection to the microsecond.',
    principle: 'Differential Hall-effect sensors detect magnetic flux variations from a 60-minus-2 tooth target wheel on the crankshaft and a single-tooth wheel on the intake camshaft. The missing teeth establish absolute engine top-dead-centre (TDC) phasing.',
    specs: [['Speed Range', '0 to 16,500 rpm'], ['Timing Accuracy', '< 0.1° crank angle'], ['Pulse Frequency', 'Up to 20 kHz pulse train'], ['Operating Temp', '–40 °C to +200 °C'], ['Redundancy', 'Dual crank pickups']],
    reading: 'Shows characteristic saw-tooth profile through the gears. Shift points are calibrated to match engine peak volumetric efficiency and transmission gear step ratios.',
    failure: 'The engine cannot run. Without crankshaft angle synchronization, the SECU cannot time ignition coils or direct fuel injectors, causing instant engine shutdown.',
    investigation: '1. Verify crank sensor air gap (0.6 mm ± 0.1 mm) to tone wheel. 2. Check oscilloscope waveform for missing teeth synchronization. 3. Test sensor coil resistance and wiring harness shield.',
  },
  sen_fuel_flow: {
    group: 'engine', live: 'fuelFlow', fx: 'pulse', hz: 100,
    plain: 'An ultrasonic flow meter measuring fuel consumption to verify legal energy limits.',
    principle: 'Opposing piezoelectric ultrasonic transducers transmit acoustic pulses upstream and downstream through the fuel passage. The time-of-flight difference between acoustic pulses is directly proportional to fuel flow velocity ($v$). With temperature-based density compensation, mass flow and energy flow are calculated without moving parts.',
    specs: [['Energy Limit (2026)', '3,000 MJ/h maximum energy flow'], ['Accuracy', '± 0.25 % of reading'], ['Sampling Rate', '100 Hz (encrypted)'], ['Transducer', 'Dual ultrasonic acoustic path'], ['Fluid Compatibility', '100% sustainable advanced biofuel']],
    reading: 'Fuel flow rises proportionally with engine rpm and throttle until reaching the regulated 3,000 MJ/h cap under full throttle. Teams optimize combustion to maximize power right on the limit.',
    failure: 'The SECU cannot prove compliance with fuel consumption limits. Scrutineers immediately mandate a drive-through penalty or disqualification.',
    investigation: '1. Inspect fuel filter upstream of flow meter for contamination. 2. Check ultrasonic transducer signal-to-noise ratio. 3. Verify encrypted FIA calibration certificates.',
  },
  sen_fuel_pressure: {
    group: 'engine', live: 'fuelPress', fx: 'pulse', hz: 2000,
    plain: 'A high-pressure sensor monitoring the 500-bar direct injection fuel rail.',
    principle: 'High-pressure fuel exerts force against a silicon piezoresistive micro-diaphragm. The resulting resistance shift drives an instrumentation amplifier to measure rail pressure up to 500 bar with microsecond response.',
    specs: [['Pressure Range', '0 to 600 bar'], ['Nominal Rail Pressure', 'Up to 500 bar'], ['Sampling Rate', '2,000 Hz (2 kHz)'], ['Burst Rating', '> 1,200 bar'], ['Response Time', '< 0.5 ms']],
    reading: 'Common rail pressure must stay above 400 bar under high engine load to ensure fine fuel droplet atomisation. A dip in pressure under full throttle indicates high-pressure pump cavitation.',
    failure: 'Fuel atomisation degrades, inducing cylinder-to-cylinder fuel imbalance and catastrophic high-load pre-ignition knock. The SECU reduces engine power to protect pistons.',
    investigation: '1. Check high-pressure mechanical pump drive and delivery valve. 2. Inspect low-pressure lift pump delivery pressure (> 6 bar). 3. Test pressure sensor bridge output voltage.',
  },
  sen_oil_coolant_temp: {
    group: 'engine', live: 'coolant', fx: 'pulse', hz: 20,
    plain: 'Fluid temperature and pressure probes protecting the engine from overheating and bearing starvation.',
    principle: 'Precision platinum thin-film RTDs (PT1000) measure cooling water and dry-sump oil temperatures. Co-located piezoresistive sensors track lubrication circuit oil pressures.',
    specs: [['Temperature Range', '–30 °C to +160 °C'], ['Oil Pressure Range', '0 to 10 bar'], ['Sampling Rate', '20 Hz'], ['RTD Accuracy', '± 0.15 °C (Class A)'], ['Operating Pressure', '3.5 to 5.5 bar nominal oil pressure']],
    reading: 'Coolant runs between 95 °C and 110 °C. Exceeding 118 °C triggers driver warning alerts to move out of the aerodynamic wake of the preceding car or lift-and-coast.',
    failure: 'Engineers lose visibility of cooling efficiency. Overheating can lead to head gasket breach or crankshaft main bearing seizure within two laps.',
    investigation: '1. Check radiator ducting for plastic tear-offs or rubber pickup blockage. 2. Inspect dry-sump scavenge pump belt. 3. Check oil circuit pressure-relief valve.',
  },
  sen_exhaust_lambda: {
    group: 'engine', live: 'lambda', fx: 'pulse', hz: 100,
    plain: 'A wideband oxygen sensor in the exhaust pipe measuring fuel-air combustion ratio and exhaust temperature.',
    principle: 'A planar zirconia ceramic cell pumps oxygen ions across an electrolyte substrate to maintain a reference stoichiometric balance. The required electrochemical pumping current directly quantifies excess air ratio ($\lambda$). An adjacent mineral-insulated thermocouple measures gas temperatures up to 1,050 °C.',
    specs: [['Lambda Range', '0.70 to 1.40 λ'], ['Exhaust Temp Range', 'Up to 1,050 °C'], ['Sampling Rate', '100 Hz'], ['Sensor Type', 'Wideband planar zirconia (UEGO)'], ['Heater Control', 'Closed-loop 780 °C ceramic heater']],
    reading: 'Full-throttle combustion operates near $\\lambda = 1.00$. Throttle lift-off induces brief lean excursions ($\lambda > 1.15$). Gas temperatures above 1,000 °C threaten turbine wheel durability.',
    failure: 'The SECU reverts to an open-loop rich fueling table, consuming excessive fuel and risking turbocharger thermal fatigue.',
    investigation: '1. Inspect zirconia element for lead/fuel additive poisoning. 2. Check internal ceramic heater circuit resistance. 3. Verify exhaust manifold joints for air leaks.',
  },
  sen_turbo_speed: {
    group: 'engine', live: 'turbo', fx: 'pulse', hz: 10000,
    plain: 'An eddy-current sensor counting compressor wheel blades spinning past at 125,000 rpm.',
    principle: 'An eddy-current pickup on the compressor cover generates an electromagnetic field. As each titanium compressor blade passes the probe, it induces eddy currents that modulate coil impedance, generating high-frequency counting pulses.',
    specs: [['Speed Range', '0 to 135,000 rpm'], ['Sampling Rate', '10,000 Hz (pulse counting)'], ['Blade Pass Frequency', 'Up to 25 kHz'], ['Accuracy', '± 0.1 % of reading'], ['Temperature Tolerance', 'Up to 220 °C']],
    reading: 'Turbo speed ramps smoothly with engine exhaust energy, peaking near 120,000 rpm on main straights. Dips or erratic oscillations indicate compressor surge or wastegate instability.',
    failure: 'The engine management system must limit boost pressure conservatively to ensure the turbocharger compressor does not exceed its critical overspeed threshold.',
    investigation: '1. Check sensor tip air gap to compressor blade tips. 2. Inspect compressor blades for foreign object damage (FOD). 3. Audit wastegate pneumatic control solenoid.',
  },

  /* ---------------- hybrid & drivetrain ---------------- */
  sen_mguk_telemetry: {
    group: 'hybrid', live: 'mgukPower', fx: 'pulse', hz: 10000,
    plain: 'A high-speed rotor resolver and current sensor controlling 350 kW of electric motor deploy and regeneration.',
    principle: 'A brushless variable reluctance resolver tracks MGU-K motor rotor angle with sub-degree precision. Hall-effect current transducers monitor 3-phase AC currents up to 600 A, enabling field-oriented vector control (FOC) of the 350 kW permanent magnet synchronous motor.',
    specs: [['Peak Power Rating', '350 kW (476 bhp) deploy and regen'], ['Current Rating', 'Up to 600 A RMS per phase'], ['Resolver Accuracy', '< 0.1° electrical angle'], ['Operating Voltage', 'Up to 900 V DC bus'], ['Sampling Rate', '10,000 Hz (10 kHz)']],
    reading: 'Positive power indicates electrical torque deployment out of slow corners; negative power indicates massive kinetic energy recovery under braking into the Energy Store.',
    failure: 'The hybrid inverter trips offline. The car loses 350 kW (nearly half of its total power output) and must rely solely on the internal combustion engine.',
    investigation: '1. Inspect resolver excitation and sine/cosine feedback channels. 2. Check phase current balance across U, V, and W phases. 3. Verify inverter DC bus voltage and gate driver temperature.',
  },
  sen_battery_bms: {
    group: 'hybrid', live: 'soc', fx: 'pulse', hz: 100,
    plain: 'A battery management system tracking individual cell voltages and state of charge across the 4 MJ energy store.',
    principle: 'Distributed ASIC measurement chips monitor individual pouch cell voltages (mV) and thermal thermistors. A high-precision digital shunt measures total current integration (Coulomb counting) to track state-of-charge within regulatory limits.',
    specs: [['Energy Store Capacity', '4 MJ regulatory usable swing per lap'], ['Cell Voltage Accuracy', '± 1.5 mV'], ['Thermal Channels', '> 80 cell thermistors'], ['Bus Voltage', 'Up to 900 V DC'], ['Sampling Rate', '100 Hz']],
    reading: 'State of charge exhibits a saw-tooth profile, discharging down to ~15% at the end of long straights and refilling toward 85% during heavy braking zones.',
    failure: 'If any cell exceeds voltage or temperature thresholds, the master BMS opens high-voltage pyrofuses/contactors, completely isolating the battery for fire safety.',
    investigation: '1. Review individual cell voltage balance delta (< 15 mV normal). 2. Check cell temperature distribution for localized hotspots. 3. Test high-voltage chassis isolation resistance (> 500 Ohm/V).',
  },
  sen_driveshaft_torque: {
    group: 'hybrid', live: 'shaftTorque', fx: 'pulse', hz: 1000,
    plain: 'A non-contact telemetry collar on the driveshafts measuring total power delivered to the wheels.',
    principle: 'Surface Acoustic Wave (SAW) resonant strain elements are bonded directly to the titanium driveshaft tube. Mechanical torque twists the shaft, altering acoustic wave propagation velocity. A stationary pickup collar interrogates the SAW resonators wirelessly via RF.',
    specs: [['Torque Range', '–1,000 Nm to +4,500 Nm'], ['Sampling Rate', '1,000 Hz (1 kHz)'], ['Accuracy', '± 0.5 % Full Scale'], ['Transmission', 'Non-contact RF resonant link'], ['Operating Temp', '–20 °C to +150 °C']],
    reading: 'Torque peaks in lower gear full-throttle acceleration (up to 4,000+ Nm total wheel torque) and drops as aerodynamic drag rises. Under braking, regenerative torque turns negative.',
    failure: 'The FIA cannot verify compliance with total wheel power output limits. The car is flagged for immediate scrutineering inspection.',
    investigation: '1. Check stationary RF antenna collar air gap to driveshaft ring. 2. Verify SAW resonator zero-torque baseline calibration. 3. Test receiver node CAN bus telegrams.',
  },
  sen_gearbox_sensor: {
    group: 'hybrid', live: 'gear', fx: 'pulse', hz: 1000,
    plain: 'Rotary position and hydraulic pressure sensors timing seamless gear shifts in under 50 milliseconds.',
    principle: 'A contactless Hall rotary encoder tracks the angular position of the shift selector barrel. High-speed hydraulic pressure transducers monitor pressure in the pneumatic shift actuators to coordinate torque reduction during shifts.',
    specs: [['Transmission Type', '8-speed seamless-shift cassette'], ['Shift Duration', '< 40 ms torque cut'], ['Position Resolution', '< 0.1° barrel angle'], ['Hydraulic Pressure', 'Up to 200 bar actuator pressure'], ['Sampling Rate', '1,000 Hz']],
    reading: 'Gear state steps sequentially through 1 to 8. Shift duration traces show the millisecond-level torque-reduction window between dog disengagement and engagement.',
    failure: 'The SECU cannot verify shift drum position and disables seamless shifting, resulting in slow, harsh shifts or transmission limp-home mode.',
    investigation: '1. Check shift barrel potentiometer voltage calibration per gear notch. 2. Verify pneumatic/hydraulic system shift pressure (> 160 bar). 3. Audit shift solenoid valve response time.',
  },

  /* ---------------- electronics & telemetry ---------------- */
  sen_secu: {
    group: 'comms', live: 'canLoad', fx: 'pulse', hz: 1000,
    plain: 'The mandatory FIA central computer running standard software to eliminate illegal traction control.',
    principle: 'The McLaren Applied TAG-320 represents the standardized central engine and chassis control unit required by FIA regulations across all Formula 1 constructors. It executes certified control laws, coordinates vehicle sensor buses, and logs scrutineering telemetry to enforce technical compliance.',
    specs: [
      ['Architecture Concept', 'McLaren Applied TAG-320 representative model'],
      ['Processing Core', 'Automotive multi-core embedded controller'],
      ['Network Topologies', 'Prioritized CAN / Automotive bus architecture'],
      ['Simulated Telemetry', '32 core parameters (modelled from 1000s of F1 data channels)'],
      ['Logging Function', 'Scrutineering state and event logging']
    ],
    reading: 'Monitors CAN bus network utilization percentage (target < 75%) and processor core load. Spikes above 85% indicate bus arbitration contention.',
    failure: 'Total vehicle shutdown. The SECU controls ignition, fuel injection, hybrid power, and communications; failure leaves the car inert on track.',
    investigation: '1. Connect SECU diagnostic console via dedicated interface loom. 2. Inspect power supply rail voltages (12V and 5V regulated). 3. Check CAN bus termination resistance (60 Ohm across lines).',
  },
  sen_telemetry_antenna: {
    group: 'comms', live: 'rssi', fx: 'rf', hz: 100,
    plain: 'A shark fin RF telemetry antenna streaming simulated vehicle data to the pit wall.',
    principle: 'Conformal radio-frequency antenna element integrated into the shark fin engine cover, representing motorsport wireless car-to-pit telemetry streaming to trackside receiver towers. In reality, modern F1 cars use dedicated motorsport burst telemetry links.',
    specs: [
      ['RF Link Concept', 'Bidirectional car-to-pit wireless telemetry stream'],
      ['Frequency Concept', 'Motorsport telemetry RF spectrum (representative)'],
      ['Link Quality Metric', 'Simulated RSSI (–100 dBm to –40 dBm)'],
      ['Coverage Model', 'Continuous circuit perimeter link'],
      ['Transmission Mode', 'Real-time telemetry burst simulation']
    ],
    reading: 'RSSI signal strength fluctuates between –50 dBm (strong link near pit straight towers) and –85 dBm (distant circuit sectors). Dips below –92 dBm indicate packet loss risks.',
    failure: 'Real-time telemetry to the pit wall stops. Engineers must rely on driver voice radio and download accumulated data from onboard flash memory during pit stops.',
    investigation: '1. Inspect RF antenna coaxial cable connection and termination. 2. Verify trackside receiver station link status. 3. Check onboard telemetry modem status.',
  },
};
