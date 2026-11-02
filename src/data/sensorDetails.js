/**
 * Deep-dive content for every sensor in the catalogue, merged into SENSORS in sensors.js.
 *
 *   group      subsystem used for the list, the tour order and prev/next navigation
 *   live       key of the simulated telemetry channel the sensor "reads" (see telemetry.js)
 *   fx         3D effect shown on the car when the sensor is selected:
 *              pulse | laser | ir | airflow | rf
 *   hz         representative sample rate in Hz (also paces the pulse animation)
 *   plain      one-sentence everyday comparison
 *   principle  the physics: how the measurement is actually made
 *   specs      representative figures (real values are team-confidential)
 *   reading    how an engineer reads the trace
 *   failure    what happens when the sensor lies or dies
 *   notes      optional plain-English note for the first stages of the signal path
 */

export const SENSOR_GROUPS = [
  { id: 'wheels', label: 'Wheels & tyres', blurb: 'Where the car meets the road.' },
  { id: 'brakes', label: 'Brakes & suspension', blurb: 'How hard the car stops, and how the chassis moves.' },
  { id: 'aero', label: 'Aero & airflow', blurb: 'Measuring the invisible: air.' },
  { id: 'chassis', label: 'Chassis & safety', blurb: 'Motion, crash recording and position.' },
  { id: 'driver', label: 'Driver & cockpit', blurb: 'Driver inputs and driver health.' },
  { id: 'engine', label: 'Engine & fuel', blurb: 'Combustion engine health and fuel limits.' },
  { id: 'hybrid', label: 'Hybrid & drivetrain', blurb: 'Electrical power and the road to the wheels.' },
  { id: 'comms', label: 'Electronics & telemetry', blurb: 'The brain and the radio link.' },
];

/* Plain-English explanation for each stage of a signal path, matched by keyword. */
const NODE_NOTES = [
  [/SECU|ECU/i, 'The FIA Standard ECU, the one control unit every team must use. It logs, scales and forwards the channel.'],
  [/CAN/i, 'CAN bus: a shared two-wire network. Each message carries an ID, a value and a checksum, so errors are caught.'],
  [/RF|433|radio|BLE|wireless|Bluetooth/i, 'A short radio hop, used where a wire cannot go (a spinning wheel, a driver’s glove).'],
  [/harness|loom|sub-loom/i, 'Shielded wiring loom. Twisted pairs and screening keep hybrid-system electrical noise out of the signal.'],
  [/analog|analogue|0-5V|SPI|serial/i, 'A direct, very low-latency electrical link, with no network in the way.'],
  [/telemetry|logger|broadcast|transmitter|trackside/i, 'Logged on board and streamed to the pit wall so engineers can see it live.'],
  [/amplifier|transducer|conditioner|counter|inverter|ASIC|MCU|node/i, 'Signal conditioning: turns a tiny raw signal into a clean digital number.'],
];
export function explainStage(label, custom) {
  if (custom) return custom;
  for (const [re, text] of NODE_NOTES) if (re.test(label)) return text;
  return 'A processing stage that cleans, scales or relays the signal on its way to the ECU.';
}

export const SENSOR_DETAILS = {
  /* ---------------- wheels & tyres ---------------- */
  sen_wheel_speed: {
    group: 'wheels', live: 'wheelSpeed', fx: 'pulse', hz: 1000,
    plain: 'A bicycle speedometer, but read 1,000 times a second on every wheel.',
    principle: 'A toothed ring spins with the hub. An optical pickup counts how fast the teeth interrupt a light beam. Comparing the four wheels reveals slip: a driven wheel spinning faster than the others means it has lost grip.',
    specs: [['Range', '0–350 km/h equivalent'], ['Typical rate', '1 kHz'], ['Resolution', '< 0.1 km/h'], ['Output', 'Pulse train to CAN']],
    reading: 'Rear wheel speed rising above front wheel speed on corner exit is wheelspin. The same trace shows a front wheel locking under braking as a sudden drop.',
    failure: 'The ECU loses its slip estimate and falls back to conservative differential and power-delivery maps. The car gets slower but stays safe.',
    notes: ['Counts tooth passes. Each tooth is one pulse.', 'A short, shielded lead runs up the upright to the chassis.'],
  },
  sen_tpms: {
    group: 'wheels', live: 'tpms', fx: 'rf', hz: 10,
    plain: 'Like the pressure monitor in a road car’s tyre, only it also reads the air temperature inside the wheel.',
    principle: 'A tiny silicon pressure cell and thermistor sit in the rim cavity. Because the wheel spins at up to 2,500 rpm, the reading is sent by radio to a receiver on the hub, with no wires and no slip rings.',
    specs: [['Range', '0–4 bar, –20 to 150 °C'], ['Typical rate', '10 Hz'], ['Accuracy', '± 0.01 bar'], ['Link', '433 MHz radio']],
    reading: 'Pressure climbs as the tyre heats, so a rise of a few hundredths of a bar per lap is normal. A sudden drop means a puncture long before the driver feels it.',
    failure: 'Without it, teams lose the live check that tyres stay above their minimum safe pressure, so the car is called in for a manual check.',
    notes: ['Silicon pressure cell and thermistor, powered by a small battery.', 'Transmitted over a short-range radio hop to the hub.'],
  },
  sen_tyre_ir: {
    group: 'wheels', live: 'tyreSurf', fx: 'ir', hz: 100,
    plain: 'A heat camera that never touches the tyre. It reads three temperatures across the tread at once.',
    principle: 'Every hot surface glows in infrared. A thermopile behind a lens collects that glow and converts it to a voltage; the more infrared, the higher the temperature. Three zones (inner, centre, outer) show how evenly the tyre is working.',
    specs: [['Range', '0–250 °C'], ['Zones', '3 across the tread'], ['Typical rate', '100 Hz'], ['Response', '< 10 ms']],
    reading: 'A hot inner shoulder means too much negative camber. A hot centre means over-inflation. Engineers tune camber and pressure until all three zones sit together.',
    failure: 'No safety impact, but engineers lose their tyre-balance picture and setup work becomes guesswork.',
  },

  /* ---------------- brakes & suspension ---------------- */
  sen_brake_disc_temp: {
    group: 'brakes', live: 'discTemp', fx: 'ir', hz: 100,
    plain: 'An infrared thermometer aimed at a glowing disc. At night you can see the same thing with your own eyes.',
    principle: 'Carbon-carbon discs glow orange-white above 700 °C. A non-contact infrared pyrometer reads that radiation, so it does not need to touch a spinning, white-hot component.',
    specs: [['Range', '200–1,200 °C'], ['Typical rate', '100 Hz'], ['Ideal window', '350–800 °C'], ['Response', '< 10 ms']],
    reading: 'Spikes show up at every braking zone, then fall away on the straights. Below the window the disc grips poorly. Above it, the carbon starts to oxidise and wear very quickly.',
    failure: 'The team cannot trust brake-duct choices. They may fit larger ducts and accept an aero penalty to stay safe.',
  },
  sen_brake_pressure: {
    group: 'brakes', live: 'brakePress', fx: 'pulse', hz: 1000,
    plain: 'The pressure gauge on a bicycle pump, but fast enough to follow a driver’s foot.',
    principle: 'Hydraulic fluid presses on a thin steel diaphragm that carries strain gauges. The diaphragm flexes a few microns, the gauge resistance changes, and a bridge circuit converts it into a voltage proportional to pressure.',
    specs: [['Range', '0–200 bar'], ['Typical rate', '1 kHz'], ['Accuracy', '± 0.25 % FS'], ['Output', '0–5 V analogue']],
    reading: 'The trace looks like the driver’s foot. A sharp rise and a gentle taper is a good brake release. Front pressure versus rear MGU-K regeneration is what the brake-by-wire controller balances.',
    failure: 'The brake-by-wire system switches to a fixed fallback balance, which is safe but not optimal.',
  },
  sen_pushrod_load: {
    group: 'brakes', live: 'pushrod', fx: 'pulse', hz: 500,
    plain: 'A bathroom scale built into the suspension arm that weighs the car’s downforce in real time.',
    principle: 'Strain gauges are glued to the pushrod, in a full bridge to cancel temperature drift. When the rod is squeezed or stretched by a few microns, the gauges change resistance and the amplifier turns that into a force reading.',
    specs: [['Range', '± 20 kN'], ['Typical rate', '500 Hz'], ['Accuracy', '± 0.2 % FS'], ['Output', 'Amplified, digital CAN']],
    reading: 'Load climbs with the square of speed because downforce does. Sharp spikes are kerbs. The difference between left and right shows weight transfer through a corner.',
    failure: 'Aerodynamicists lose their best real-world downforce measurement. Simulation and wind-tunnel numbers can no longer be checked against the track.',
  },
  sen_damper_pos: {
    group: 'brakes', live: 'damper', fx: 'pulse', hz: 1000,
    plain: 'A slider like a volume fader. As the suspension moves, so does the slider.',
    principle: 'A sliding contact moves along a precision resistive track, or an optical encoder counts marks. Differentiating position gives damper velocity, which is what the damper’s oil valving actually acts on.',
    specs: [['Range', '0–75 mm'], ['Typical rate', '1 kHz'], ['Resolution', '0.02 mm'], ['Output', 'Analogue to CAN node']],
    reading: 'A histogram of damper velocity tells engineers whether the damper spends its life in the low-speed or high-speed region, which sets how it must be tuned.',
    failure: 'Ride-height and platform-control analysis loses its reference, so setup work slows down.',
  },
  sen_ride_height: {
    group: 'brakes', live: 'rideHeight', fx: 'laser', hz: 500,
    plain: 'A laser tape measure pointed at the road, measuring the gap to the tarmac thousands of times a second.',
    principle: 'A laser spot lands on the track. A lens images it onto a position-sensitive detector at a slight angle; as the car gets closer the spot moves across the detector. The geometry converts spot position straight into distance (laser triangulation).',
    specs: [['Range', '5–50 mm'], ['Typical rate', '500 Hz'], ['Resolution', '0.05 mm'], ['Output', 'Serial, to logger']],
    reading: 'The car squats toward the track as speed builds because the floor’s suction increases. Engineers want the floor as close as possible without touching, since the plank must not wear beyond the legal limit.',
    failure: 'Without it, teams must run the car higher to be safe, giving away a lot of downforce.',
  },
  sen_steer_angle_torque: {
    group: 'driver', live: 'steer', fx: 'pulse', hz: 1000,
    plain: 'It records how far the wheel is turned and how hard the driver is pushing it.',
    principle: 'A dual optical encoder reads a coded disc to give the angle. A short torsion bar twists very slightly under driver effort, and strain gauges on it turn that twist into torque. Two channels are measured for redundancy.',
    specs: [['Angle range', '± 360°'], ['Torque range', '± 30 Nm'], ['Typical rate', '1 kHz'], ['Redundancy', 'Dual channel']],
    reading: 'Plotting steering angle against lateral g shows understeer and oversteer: more steering for less cornering force means the front tyres are sliding.',
    failure: 'Power-steering assist and differential strategies lose their main input and revert to safe defaults.',
  },

  /* ---------------- aero ---------------- */
  sen_pitot_array: {
    group: 'aero', live: 'airspeed', fx: 'airflow', hz: 200,
    plain: 'The same tube airliners use to measure airspeed, mounted on the very tip of the nose.',
    principle: 'The front hole catches the air head-on (total pressure). Side holes measure the surrounding static pressure. The difference is dynamic pressure, which is proportional to airspeed squared. Extra ports on the sides measure the angle of the airflow (yaw).',
    specs: [['Range', '0–400 km/h'], ['Typical rate', '200 Hz'], ['Accuracy', '± 0.5 %'], ['Ports', '5 (1 centre + 4 angle)']],
    reading: 'True airspeed is independent of wheel slip, so engineers can see the benefit of a slipstream: airspeed rising faster than the car’s own power would give.',
    failure: 'Team loses its crosswind and slipstream data, but car control is unaffected.',
  },
  sen_active_aero_pos: {
    group: 'aero', live: 'aeroFlap', fx: 'pulse', hz: 1000,
    plain: 'It checks that the wing really moved when it was told to, like a door sensor that confirms the door is shut.',
    principle: 'A LVDT is a hollow transformer with a moving magnetic core. The core position changes how strongly the primary coil couples to two secondary coils, so the voltage difference between them is directly proportional to position, with no contact and no wear.',
    specs: [['Range', '± 25 mm stroke'], ['Typical rate', '1 kHz'], ['Linearity', '± 0.1 %'], ['Output', 'AC to digital']],
    reading: 'The trace flips between Straight Mode (flaps flat, low drag) and Corner Mode (flaps open, more downforce). The speed of each flip is exactly what scrutineers verify.',
    failure: 'The ECU cannot prove the flaps moved, so it commands a safe wing mode and flags the fault to the FIA.',
  },
  sen_wing_strain: {
    group: 'aero', live: 'wingStrain', fx: 'pulse', hz: 500,
    plain: 'It measures how much the rear wing bends, like watching a diving board flex under a swimmer.',
    principle: 'Strain gauges bonded to the carbon pylon stretch very slightly as the wing loads up. The tiny resistance change (a few parts per million) is amplified to give bending moment, which maps to rear downforce.',
    specs: [['Range', '0–3,000 µε'], ['Typical rate', '500 Hz'], ['Accuracy', '± 1 % FS'], ['Output', 'Instrument bus']],
    reading: 'Strain peaks at top speed. Comparing Straight Mode and Corner Mode shows how much load the wing sheds when its flaps flatten.',
    failure: 'Structural correlation is lost. Teams run extra safety margin on pylon stiffness, which costs weight.',
  },
  sen_ambient_probe: {
    group: 'aero', live: 'ambient', fx: 'pulse', hz: 10,
    plain: 'A weather station riding on the car, measuring air temperature and pressure.',
    principle: 'A calibrated thermistor changes resistance with temperature, and a MEMS barometer measures air pressure. Together they give air density, which controls how much power the engine can make and how much downforce the wings generate.',
    specs: [['Temp range', '–20 to 60 °C'], ['Pressure range', '700–1,100 mbar'], ['Typical rate', '10 Hz'], ['Accuracy', '± 0.1 °C']],
    reading: 'Hot, thin air means less power and less downforce. Engineers use this reading to adjust engine maps and wing settings between sessions.',
    failure: 'Air-density corrections fall back to the weather station’s trackside numbers, which are less precise.',
  },

  /* ---------------- chassis & safety ---------------- */
  sen_chassis_imu: {
    group: 'chassis', live: 'imu', fx: 'pulse', hz: 1000,
    plain: 'The same chip that tells your phone which way is up, only 100 times more accurate.',
    principle: 'MEMS accelerometers sense acceleration along three axes as tiny silicon masses move. MEMS gyroscopes sense rotation rate along three axes using vibrating structures (the Coriolis effect). Together they define the car’s motion.',
    specs: [['Accel range', '± 16 g'], ['Gyro range', '± 500 °/s'], ['Typical rate', '1 kHz'], ['Output', 'SPI to ECU']],
    reading: 'Lateral g against speed shows how much grip the car has through a corner. Combining the gyro and accelerometers gives the car’s sideways slip angle, which no other sensor measures directly.',
    failure: 'The car loses its motion state estimate. Control strategies that rely on it must run in a simplified mode.',
  },
  sen_adr_crash: {
    group: 'chassis', live: 'adrG', fx: 'pulse', hz: 1000,
    plain: 'The “black box” from an aeroplane, built into a race car.',
    principle: 'High-g accelerometers watch continuously. When an impact exceeds a trigger, the unit stores the full deceleration trace and keeps recording on its own backup battery. The FIA medical team reads it out after a big incident.',
    specs: [['Range', 'Up to 400 g'], ['Typical rate', '1 kHz+'], ['Storage', 'Crash-hardened memory'], ['Power', 'Internal backup battery']],
    reading: 'Normal driving is below about 1 g. Kerb strikes show as short spikes of a few g and do not trigger the recorder. A real crash shows a large, short peak, and its duration tells doctors how survivable the impact was.',
    failure: 'The car cannot pass scrutineering. Without the ADR the car is not allowed to run.',
  },
  sen_gps_timing: {
    group: 'chassis', live: 'lapDist', fx: 'rf', hz: 20,
    plain: 'The same satellite positioning as your phone, with centimetre accuracy and a stopwatch built in.',
    principle: 'A multi-constellation GNSS receiver compares signals from several satellites to compute position. A separate transponder reacts to loops in the track surface, which gives the official sector and lap times.',
    specs: [['Position accuracy', '≈ 2 cm (corrected)'], ['Typical rate', '20 Hz'], ['Timing', 'Loop-triggered'], ['Output', 'Transponder to timing system']],
    reading: 'Plotting lap distance against speed gives a speed trace comparison between two drivers: where one brakes later or gets on the power sooner.',
    failure: 'Live position falls back to timing loops, so the broadcast track map and automatic flag warnings lose resolution.',
  },

  /* ---------------- driver & cockpit ---------------- */
  sen_pedal_pos: {
    group: 'driver', live: 'throttle', fx: 'pulse', hz: 1000,
    plain: 'It is the electronic equivalent of a throttle cable, only with two independent senses in case one fails.',
    principle: 'Two separate rotary potentiometers measure pedal angle. If the two disagree by more than a small margin, the ECU knows one is faulty and does not trust either. That redundancy is what makes throttle-by-wire safe.',
    specs: [['Range', '0–100 %'], ['Typical rate', '1 kHz'], ['Redundancy', '2 independent channels'], ['Output', 'Shielded analogue']],
    reading: 'Throttle and brake traces never overlap on a clean lap. A tiny overlap is “trail braking”, used on purpose to rotate the car into a corner.',
    failure: 'If the two channels disagree, the ECU limits power to a safe level so the driver cannot get unintended acceleration.',
  },
  sen_biometric_glove: {
    group: 'driver', live: 'heartRate', fx: 'rf', hz: 4,
    plain: 'A smartwatch sewn into the driver’s glove.',
    principle: 'A small LED shines through the skin; blood absorbs the light differently depending on oxygen content and the pulse changes the absorption rhythmically. A detector turns that into heart rate and blood-oxygen (SpO₂). It transmits over Bluetooth Low Energy.',
    specs: [['Measures', 'Heart rate, SpO₂, skin temp'], ['Typical rate', '1–4 Hz'], ['Link', 'Bluetooth LE'], ['Mandated since', '2018']],
    reading: 'A driver’s heart rate rises toward 170–190 bpm in heavy braking zones and long high-g corners. Medical teams use the trace after an impact to see how the driver is doing.',
    failure: 'The medical team loses vital-sign data during a crash, so the response relies on observation alone.',
  },
  sen_ear_accel: {
    group: 'driver', live: 'headG', fx: 'rf', hz: 1000,
    plain: 'A crash-test dummy’s head sensor, built into the driver’s ear-plugs.',
    principle: 'A small MEMS accelerometer is moulded into the driver’s custom earpiece, so it moves with the skull. Head acceleration shows doctors how hard the head was hit, and in which direction.',
    specs: [['Range', '± 250 g'], ['Axes', '3'], ['Typical rate', '1 kHz'], ['Mounting', 'Custom ear-mould']],
    reading: 'Everyday cornering gives about 1–3 g of head load. Medical staff compare impact peaks and durations against known injury thresholds to decide on a concussion check.',
    failure: 'Doctors lose a direct measurement of head impact, which makes post-crash assessment less precise.',
  },
  sen_marshal_lights: {
    group: 'driver', live: 'flag', fx: 'rf', hz: 10,
    plain: 'Flag signals shown on a screen, so the driver cannot miss them.',
    principle: 'Race control sends flag status by radio. The car’s receiver passes it to the ECU, which lights the panel on the steering wheel in the driver’s peripheral vision.',
    specs: [['Statuses', 'Green, yellow, red, VSC, SC'], ['Typical rate', 'Event-driven'], ['Link', 'FIA trackside radio'], ['Display', 'LED panel on wheel']],
    reading: 'The simulated lap shows a yellow in sector 2. The panel changes at the same moment the marshals wave the flag, so drivers never miss it.',
    failure: 'The driver falls back to trackside flags and the team radio, as in earlier eras.',
  },

  /* ---------------- engine & fuel ---------------- */
  sen_crank_cam_rpm: {
    group: 'engine', live: 'rpm', fx: 'pulse', hz: 20000,
    plain: 'It counts the teeth on a spinning wheel so the engine knows where every piston is.',
    principle: 'A Hall-effect sensor detects the magnetic field change as each tooth of a 60-minus-2 trigger wheel passes. The two missing teeth give a unique reference point for crank position; the camshaft sensor tells the ECU which stroke each cylinder is on.',
    specs: [['Range', '0–16,000 rpm'], ['Resolution', '< 1° crank angle'], ['Typical rate', 'Kilohertz pulse train'], ['Output', 'Differential digital']],
    reading: 'The rpm trace saw-tooths with each gearshift. The point where it peaks is the shift point chosen by the driver or the engineers.',
    failure: 'The engine cannot fire. Without crank position there is no ignition or injection timing, so the car stops.',
  },
  sen_fuel_flow: {
    group: 'engine', live: 'fuelFlow', fx: 'pulse', hz: 100,
    plain: 'A stopwatch for fuel: it measures how long sound takes to cross the pipe.',
    principle: 'Two ultrasonic transducers send pulses along the fuel line, one with the flow and one against it. The pulse with the flow arrives slightly sooner. That time difference is proportional to flow speed, and with density it gives mass flow, with no moving parts.',
    specs: [['Limit (2026)', '3,000 MJ/h'], ['Typical rate', '100 Hz'], ['Accuracy', '± 0.25 %'], ['Output', 'Encrypted FIA link']],
    reading: 'Fuel energy flow rises with throttle and engine speed and is clamped at the legal maximum. Staying just under the limit is the whole game.',
    failure: 'The car cannot prove it is within the fuel rules, so it is called to the pits.',
  },
  sen_fuel_pressure: {
    group: 'engine', live: 'fuelPress', fx: 'pulse', hz: 2000,
    plain: 'A pressure gauge for the fuel that is about to be squirted into each cylinder.',
    principle: 'A piezoresistive silicon cell converts fluid pressure to a resistance change. The ECU needs it to calculate injector opening time, since how long the injector stays open must be adjusted for how hard the fuel is being pushed.',
    specs: [['Range', '0–600 bar'], ['Typical rate', '2 kHz'], ['Accuracy', '± 0.25 % FS'], ['Max rail pressure', '500 bar']],
    reading: 'Pressure rises with throttle and engine speed. Dips under load can mean a pump problem.',
    failure: 'The ECU cannot fine-tune injection and falls back to a conservative fuel map, losing power.',
  },
  sen_oil_coolant_temp: {
    group: 'engine', live: 'coolant', fx: 'pulse', hz: 20,
    plain: 'The temperature gauge in your car’s dashboard, only measuring with accuracy and checking pressure as well.',
    principle: 'A thermistor’s resistance falls as it warms, and a strain-gauge pressure cell measures the circuit’s pressure. Together they warn of boiling coolant or a failing pump long before the engine is damaged.',
    specs: [['Temp range', '–40 to 200 °C'], ['Pressure range', '0–6 bar'], ['Typical rate', '20 Hz'], ['Output', 'To powertrain node']],
    reading: 'Coolant temperature rises in traffic and falls on clear air. The team uses it to decide whether to open bodywork to cool the car.',
    failure: 'The team loses early warning of overheating and the driver is told to lift and coast.',
  },
  sen_exhaust_lambda: {
    group: 'engine', live: 'lambda', fx: 'pulse', hz: 100,
    plain: 'A sniffer that tells the engine whether it is burning too rich or too lean.',
    principle: 'A zirconia cell generates a voltage depending on how much oxygen is in the exhaust, which gives the air-to-fuel ratio. A K-type thermocouple beside it measures gas temperature, which is crucial for protecting the turbine.',
    specs: [['Lambda range', '0.7–1.5'], ['Gas temp', 'Up to 1,050 °C'], ['Typical rate', '100 Hz'], ['Output', 'Engine loom to ECU']],
    reading: 'Lambda near 1.0 is chemically perfect combustion. Lifting off the throttle runs lean for a moment (a spike above 1.0).',
    failure: 'Teams must run a richer, slower mixture to protect the turbine from heat damage.',
  },
  sen_turbo_speed: {
    group: 'engine', live: 'turbo', fx: 'pulse', hz: 10000,
    plain: 'It counts compressor blades flying past, tens of thousands of times every second.',
    principle: 'The sensor tip sees each compressor blade pass and creates a pulse each time (by eddy currents or light). A high-frequency counter converts pulse spacing into rotational speed, with direct view of a rotor that spins faster than any piston engine.',
    specs: [['Range', 'Up to 125,000 rpm'], ['Typical rate', 'Pulse counting'], ['Accuracy', '± 0.1 %'], ['Output', 'Counter to ECU']],
    reading: 'Turbo speed lags throttle slightly: that delay is turbo lag. Engineers watch the peak to avoid compressor surge.',
    failure: 'The engine runs at a lower boost limit to protect the turbo from over-speeding.',
  },

  /* ---------------- hybrid & drivetrain ---------------- */
  sen_mguk_telemetry: {
    group: 'hybrid', live: 'mgukPower', fx: 'pulse', hz: 10000,
    plain: 'It watches the electric motor’s power and rotor position, so it can be driven as smoothly as the engine.',
    principle: 'A resolver (a rotating transformer) gives rotor angle. Rogowski coils around the three phase cables sense current without contact. With both, the inverter can use field-oriented control to produce exactly the torque requested.',
    specs: [['Peak power', '350 kW'], ['Typical rate', '10 kHz'], ['Angle accuracy', '< 0.1°'], ['Output', 'Inverter MCU to ECU']],
    reading: 'Positive power is deployment out of corners; negative power is regeneration under braking. Together they average out against the 8.5 MJ per lap recovery limit.',
    failure: 'Hybrid deployment is shut off and the car is up to 350 kW down on power.',
  },
  sen_battery_bms: {
    group: 'hybrid', live: 'soc', fx: 'pulse', hz: 100,
    plain: 'The monitoring chip in a phone battery, only for a battery that can deliver hundreds of kilowatts.',
    principle: 'Dozens of small chips measure each cell’s voltage and temperature, and a current shunt measures flow in and out. The master BMS keeps every cell within limits and tracks how much of the 4 MJ allowable energy swing has been used.',
    specs: [['Cell voltage accuracy', '± 2 mV'], ['Typical rate', '100 Hz'], ['Energy swing limit', '4 MJ'], ['Isolation', 'Galvanic, SPI bus']],
    reading: 'The trace falls during acceleration and refills under braking, with the saw-tooth fitting the lap. Teams plan where along the lap they spend the energy.',
    failure: 'The battery contactors open, cutting the hybrid system. That is the safe response to a thermal event.',
  },
  sen_driveshaft_torque: {
    group: 'hybrid', live: 'shaftTorque', fx: 'pulse', hz: 1000,
    plain: 'A torque wrench that stays on the shaft while the car drives at 300 km/h.',
    principle: 'Surface acoustic wave (SAW) elements are fixed on the driveshaft. As the shaft twists under torque, their resonant frequency shifts. A pickup reads that shift wirelessly, with no slip rings.',
    specs: [['Range', '± 6,000 Nm'], ['Typical rate', '1 kHz'], ['Accuracy', '± 0.5 %'], ['Link', 'Non-contact pickup']],
    reading: 'Torque peaks in low gears and drops as speed rises. During braking it goes negative as engine braking and the MGU-K slow the car.',
    failure: 'The FIA cannot verify power at the wheels is within the rules, so the car is flagged at scrutineering.',
  },
  sen_gearbox_sensor: {
    group: 'hybrid', live: 'gear', fx: 'pulse', hz: 1000,
    plain: 'It records which gear is selected and checks the gearbox oil.',
    principle: 'A magnet on the selector barrel rotates in front of a magnetic angle sensor, and the angle identifies the gear. The ECU uses the barrel position to time the torque cut so each seamless shift takes only a few milliseconds.',
    specs: [['Gears', '8 forward + reverse'], ['Typical rate', '1 kHz'], ['Shift time', '< 50 ms'], ['Output', 'Hydraulic control block to ECU']],
    reading: 'Gear steps up the straights and drops through braking zones. Engineers compare gear-shift timing and the mismatch to rpm.',
    failure: 'The ECU cannot time the torque cut, so shifts become slower and rougher until the car is serviced.',
  },

  /* ---------------- electronics & telemetry ---------------- */
  sen_secu: {
    group: 'comms', live: 'canLoad', fx: 'pulse', hz: 1000,
    plain: 'The one computer every team has to use, so no one can hide tricks inside their own.',
    principle: 'The FIA Standard ECU runs standard software and logs every channel. Teams add their own sensors and logic around it, but cannot replace it. Select “Trace to ECU” on any sensor to see how its signal gets here.',
    specs: [['Supplier', 'McLaren Applied (TAG-320)'], ['Network', 'Dual CAN FD / Ethernet'], ['Logging', 'Continuous, tamper-evident'], ['Purpose', 'Control + scrutineering']],
    reading: 'Bus load rises with engine speed and during shifts as more messages are sent. If it climbs near the upper limit, engineers reduce channel rates.',
    failure: 'The car cannot run. The ECU is the single point through which almost everything is controlled.',
  },
  sen_telemetry_antenna: {
    group: 'comms', live: 'rssi', fx: 'rf', hz: 100,
    plain: 'A Wi-Fi router for a car at 300 km/h, talking to the pit wall.',
    principle: 'A microwave transceiver uses a fin antenna on top of the engine cover. It sends hundreds of live channels to track-side receivers and receives instructions back. Signal strength varies around the lap as the car moves relative to the aerials.',
    specs: [['Band', 'Microwave (S/C)'], ['Throughput', 'Several Mbit/s'], ['Typical rate', '100 Hz status'], ['Direction', 'Two-way']],
    reading: 'Signal strength dips behind a grandstand or in a tunnel-like section. Teams know the weak spots and plan data uploads where the link is strongest.',
    failure: 'Live telemetry stops. Engineers rely on the driver’s radio and download data in the pits.',
  },
};
