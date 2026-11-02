# Formula 1 Rules & Motorsport IoT Sensors Explorer

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/chandan-bk/formula1-sensors-upgraded)

An interactive, explodable 3D Formula 1 car (Three.js + Vite) explaining both the 2026 FIA Formula 1 Technical Regulations and **32 Real-Time Motorsport IoT Telemetry Sensors**.

👉 **Live Demo**: [https://chandan-bk.github.io/formula1-sensors-upgraded/](https://chandan-bk.github.io/formula1-sensors-upgraded/)

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
```

## Features

### Sensor network (rebuilt)

- **Live telemetry lap.** A simulated 84 s lap drives every sensor. Brake hard and the disc temperature spikes, the MGU-K regenerates, the gearbox downshifts and the tyres load up, all from one consistent model (`src/data/telemetry.js`). Pause it or run it at 0.5x / 2x from the panel.
- **Live scope on every sensor.** Each sensor card shows its current reading, an Alarm/Nominal status and a 12 s oscilloscope trace with limit lines (warning limits, ideal window, legal limit).
- **A real explanation, in three tabs.** *What it does* (what it measures, why it matters, how engineers read the trace, what happens if it fails), *How it works* (the physics, a spec grid, sample rate) and *Signal path* (an animated stage-by-stage walk from sensor to pit wall, with each stage explained).
- **Effects on the car.** Pulsing heartbeat rings paced by sample rate, accent bands that glow with the live value and flash red on an alarm, a rotating selection reticle, and sensing fields for the selected sensor: laser beam (ride height), infrared cone to the wheel (pyrometers), airflow streaks (pitot), expanding radio waves (antenna, TPMS, GPS, glove).
- **Signal links.** A glowing cable with data pulses runs from the selected sensor to the FIA ECU. Select the ECU itself, or switch on *Show all signal links*, to see the whole network converge.
- **Sensor panel.** Mini circuit map coloured by speed, speed / gear / rpm / throttle / brake HUD, effect switches, subsystem and authority filters, a searchable list grouped by subsystem with live values, and a guided tour.
- **Navigation.** Prev / next buttons in the card or the left and right arrow keys step through sensors (respecting the filters). Esc closes.
- **Fixes.** The *Focus 3D View* button now works, the 360 degree inspector no longer leaks render loops and listeners, and sensors have a larger invisible hit area so they are easy to hover.

### Rest of the explorer

- **Interactive 3D 360 degree inspector** inside the card with drag to rotate.
- **Camera focus**: fly the camera to any sensor in place on the car.
- **Disassemble and explode**: presets and an explode slider, with sensors tracking their parent parts.
- **X-ray and active aero**: inspect powertrain internals through translucent bodywork.
- **Rule and category colours**: tint components by regulatory design classification.

Where to look: `src/data/sensorDetails.js` (explanations), `src/data/telemetry.js` (simulation), `src/car/sensors.js` (3D effects), `src/ui/callout.js` and `src/ui/sensorsUI.js` (card and panel). All figures are representative, not team data.

## Deployment to Vercel

Click the **Deploy with Vercel** button above or import the repository `chandan-bk/formula1-sensors-upgraded` into your Vercel dashboard.

```bash
npx vercel --prod
```

## Sources & References

- FIA 2026 Formula 1 Technical Regulations (Issue 20).
- McLaren Applied Standard Electronic Control Unit (TAG-320 / SECU) specifications.
- Texense, Gill Sensors & Controls, Bosch Motorsport technical documentation.
