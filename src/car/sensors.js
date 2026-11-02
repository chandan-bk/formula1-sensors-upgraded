import * as THREE from 'three';
import { SENSORS, SENSOR_CATEGORIES } from '../data/sensors.js';
import { ENABLE_SENSORS, DEBUG_SENSORS } from '../config/sensorsConfig.js';
import { FRONT_AXLE_X, REAR_AXLE_X } from './dims.js';
import { CHANNELS } from '../data/telemetry.js';

/**
 * Procedural 3D Motorsport IoT Sensors Hardware Generator.
 * Models real physical 3D motorsport hardware components at prominent scale (~15-28 cm)
 * so they are immediately visible as authentic 3D parts when orbiting 360° and disassembling in Exploded view.
 */
export class SensorsManager {
  constructor({ scene, reg, state, requestRender }) {
    this.scene = scene;
    this.reg = reg;
    this.state = state;
    this.requestRender = requestRender;

    this.markers = []; // Array of marker entries
    this.markerMeshes = []; // Array of Raycast target meshes
    this.filterCategory = 'all';
    this.filterAuthority = 'all';

    // Shared reusable geometries scaled for prominent 3D mechanical visibility
    this.geos = {
      // Cylinders & tubes
      tubeProbe: new THREE.CylinderGeometry(0.016, 0.024, 0.28, 16),
      pyrometerBody: new THREE.CylinderGeometry(0.034, 0.034, 0.12, 16),
      lensCyl: new THREE.CylinderGeometry(0.028, 0.028, 0.012, 16),
      hexCollar: new THREE.CylinderGeometry(0.048, 0.048, 0.10, 6),
      spigotCyl: new THREE.CylinderGeometry(0.024, 0.024, 0.036, 12),
      potOuter: new THREE.CylinderGeometry(0.026, 0.026, 0.18, 14),
      potInner: new THREE.CylinderGeometry(0.014, 0.014, 0.16, 14),
      valveStem: new THREE.CylinderGeometry(0.012, 0.012, 0.08, 10),
      connectorGland: new THREE.CylinderGeometry(0.016, 0.016, 0.032, 12),
      baseCollar: new THREE.CylinderGeometry(0.036, 0.044, 0.048, 16),
      eyeletRing: new THREE.TorusGeometry(0.022, 0.007, 8, 16),
      // Boxes & enclosures
      flowBlock: new THREE.BoxGeometry(0.18, 0.09, 0.12),
      adrBox: new THREE.BoxGeometry(0.20, 0.10, 0.14),
      laserBox: new THREE.BoxGeometry(0.13, 0.05, 0.10),
      antennaBlade: new THREE.BoxGeometry(0.016, 0.24, 0.11),
      ecuChassis: new THREE.BoxGeometry(0.22, 0.08, 0.16),
      bracketArm: new THREE.BoxGeometry(0.018, 0.06, 0.032),
      tpmsPack: new THREE.BoxGeometry(0.10, 0.038, 0.065),
      // Mechanical accent rings (replaces freestanding glowing dots)
      accentBand: new THREE.TorusGeometry(0.052, 0.006, 8, 24),
      smallBand: new THREE.TorusGeometry(0.036, 0.005, 8, 20),
    };

    // Shared realistic motorsport materials
    this.materials = {
      titanium: new THREE.MeshStandardMaterial({ color: 0xc4c9ce, metalness: 0.9, roughness: 0.22 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.95, roughness: 0.15 }),
      anodizedBlack: new THREE.MeshStandardMaterial({ color: 0x16171a, metalness: 0.65, roughness: 0.28 }),
      billetAlum: new THREE.MeshStandardMaterial({ color: 0xe0e4e8, metalness: 0.85, roughness: 0.2 }),
      goldBrass: new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.88, roughness: 0.22 }),
      crashOrange: new THREE.MeshStandardMaterial({ color: 0xff5500, metalness: 0.25, roughness: 0.35 }),
      lensGlass: new THREE.MeshPhysicalMaterial({
        color: 0x113366,
        roughness: 0.05,
        metalness: 0.1,
        clearcoat: 1.0,
      }),
      // Sleek anodized category accents for mechanical collars
      controlAccent: new THREE.MeshStandardMaterial({
        color: new THREE.Color(SENSOR_CATEGORIES.control.color),
        metalness: 0.5,
        roughness: 0.3,
        emissive: new THREE.Color(SENSOR_CATEGORIES.control.color),
        emissiveIntensity: 0.45,
      }),
      monitoringAccent: new THREE.MeshStandardMaterial({
        color: new THREE.Color(SENSOR_CATEGORIES.monitoring.color),
        metalness: 0.5,
        roughness: 0.3,
        emissive: new THREE.Color(SENSOR_CATEGORIES.monitoring.color),
        emissiveIntensity: 0.45,
      }),
      instrumentationAccent: new THREE.MeshStandardMaterial({
        color: new THREE.Color(SENSOR_CATEGORIES.instrumentation.color),
        metalness: 0.5,
        roughness: 0.3,
        emissive: new THREE.Color(SENSOR_CATEGORIES.instrumentation.color),
        emissiveIntensity: 0.45,
      }),
    };

    // ---- live effects state ----
    this.effects = true; // halos, live glow, sensing-field effects
    this.network = false; // show every sensor's link to the ECU
    this.active = null; // marker entry of the pinned sensor
    this.byGroup = new Map();
    this.secu = null;
    this.time = 0;
    this.fx = null;
    this._v = new THREE.Vector3();
    this._w = new THREE.Vector3();
    this._c = new THREE.Color();
    this._red = new THREE.Color(0xff2d2d);
    this.fxRoot = new THREE.Group();
    this.fxRoot.name = 'sensor_fx';
    scene.add(this.fxRoot);
    this.tex = { ring: makeRingTexture(), dot: makeDotTexture(), dash: makeDashTexture() };
    this.pickGeo = new THREE.SphereGeometry(0.085, 10, 8);
    this.pickMat = new THREE.MeshBasicMaterial({ visible: false });

    if (ENABLE_SENSORS) {
      this.initMarkers();
    }
  }

  resolveTargets(sensor) {
    const pId = sensor.parentPartId;
    const targets = [];

    if (!sensor.mirrored) {
      const part = this.reg.parts.get(pId);
      if (part) targets.push({ part, anchor: { ...sensor.anchor } });
      return targets;
    }

    if (pId.endsWith('-FL')) {
      const base = pId.slice(0, -3);
      const corners = [
        { key: 'FL', x: sensor.anchor.x, z: sensor.anchor.z },
        { key: 'FR', x: sensor.anchor.x, z: -sensor.anchor.z },
        { key: 'RL', x: sensor.anchor.x - (FRONT_AXLE_X - REAR_AXLE_X), z: sensor.anchor.z },
        { key: 'RR', x: sensor.anchor.x - (FRONT_AXLE_X - REAR_AXLE_X), z: -sensor.anchor.z },
      ];
      for (const c of corners) {
        const part = this.reg.parts.get(`${base}-${c.key}`);
        if (part) {
          targets.push({ part, anchor: { x: c.x, y: sensor.anchor.y, z: c.z } });
        }
      }
      return targets;
    }

    if (pId.endsWith('-RL')) {
      const base = pId.slice(0, -3);
      for (const [key, side] of [['RL', 1], ['RR', -1]]) {
        const part = this.reg.parts.get(`${base}-${key}`);
        if (part) {
          targets.push({ part, anchor: { x: sensor.anchor.x, y: sensor.anchor.y, z: side * Math.abs(sensor.anchor.z) } });
        }
      }
      return targets;
    }

    if (pId.endsWith('-L')) {
      const base = pId.slice(0, -2);
      const partL = this.reg.parts.get(`${base}-L`);
      const partR = this.reg.parts.get(`${base}-R`);
      if (partL) targets.push({ part: partL, anchor: { ...sensor.anchor } });
      if (partR) targets.push({ part: partR, anchor: { ...sensor.anchor } });
      return targets;
    }

    const defaultPart = this.reg.parts.get(pId);
    if (defaultPart) targets.push({ part: defaultPart, anchor: { ...sensor.anchor } });
    return targets;
  }

  buildHardwareModel(sensor, group, part) {
    const meshes = [];
    const id = sensor.id;
    // each marker gets its own accent material so it can glow with its own live value
    const accents = [];
    const baseAccent =
      sensor.category === 'control'
        ? this.materials.controlAccent
        : sensor.category === 'monitoring'
        ? this.materials.monitoringAccent
        : this.materials.instrumentationAccent;
    const catAccent = baseAccent.clone();
    accents.push(catAccent);

    const tag = (mesh, isMain = false) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = {
        isSensor: true,
        isSensorMain: isMain,
        sensor,
        parentPart: part,
        markerGroup: group,
        baseScale: 1.0,
        baseMaterial: mesh.material,
      };
      group.add(mesh);
      this.markerMeshes.push(mesh);
      meshes.push(mesh);
      return mesh;
    };

    // 1. Dynamic Pitot-Static Tube Array
    if (id === 'sen_pitot_array') {
      const tube = new THREE.Mesh(this.geos.tubeProbe, this.materials.titanium);
      tube.rotation.z = Math.PI / 2;
      tube.position.x = 0.10;
      tag(tube, true);

      const collar = new THREE.Mesh(this.geos.baseCollar, this.materials.anodizedBlack);
      collar.rotation.z = Math.PI / 2;
      collar.position.x = -0.04;
      tag(collar);

      const band = new THREE.Mesh(this.geos.smallBand, catAccent);
      band.rotation.y = Math.PI / 2;
      band.position.x = 0.05;
      tag(band);
    }
    // 2. Optical Infrared Pyrometers (Brake Disc, Tyre IR)
    else if (id === 'sen_brake_disc_temp' || id === 'sen_tyre_ir') {
      const body = new THREE.Mesh(this.geos.pyrometerBody, this.materials.anodizedBlack);
      body.rotation.x = Math.PI / 2;
      tag(body, true);

      const lens = new THREE.Mesh(this.geos.lensCyl, this.materials.lensGlass);
      lens.rotation.x = Math.PI / 2;
      lens.position.z = 0.06;
      tag(lens);

      const arm = new THREE.Mesh(this.geos.bracketArm, this.materials.titanium);
      arm.position.y = -0.035;
      tag(arm);

      const conn = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
      conn.rotation.x = Math.PI / 2;
      conn.position.z = -0.07;
      tag(conn);

      const band = new THREE.Mesh(this.geos.smallBand, catAccent);
      band.position.z = 0.02;
      tag(band);
    }
    // 3. Strain-Gauge Load Cell Collars (Pushrod, Wing Strain, Driveshaft Torque)
    else if (id === 'sen_pushrod_load' || id === 'sen_wing_strain' || id === 'sen_driveshaft_torque') {
      const collar = new THREE.Mesh(this.geos.hexCollar, this.materials.titanium);
      tag(collar, true);

      for (const dy of [-0.06, 0.06]) {
        const spigot = new THREE.Mesh(this.geos.spigotCyl, this.materials.steel);
        spigot.position.y = dy;
        tag(spigot);
      }

      const gland = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
      gland.rotation.z = Math.PI / 2;
      gland.position.x = 0.055;
      tag(gland);

      const ring = new THREE.Mesh(this.geos.accentBand, catAccent);
      ring.rotation.x = Math.PI / 2;
      tag(ring);
    }
    // 4. Linear Travel Potentiometer / LVDT (Damper, Active Aero Flaps)
    else if (id === 'sen_damper_pos' || id === 'sen_active_aero_pos') {
      const outer = new THREE.Mesh(this.geos.potOuter, this.materials.anodizedBlack);
      outer.position.y = 0.04;
      tag(outer, true);

      const inner = new THREE.Mesh(this.geos.potInner, this.materials.steel);
      inner.position.y = -0.09;
      tag(inner);

      const eyelet = new THREE.Mesh(this.geos.eyeletRing, this.materials.titanium);
      eyelet.position.y = 0.14;
      tag(eyelet);

      const gland = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
      gland.rotation.z = Math.PI / 2;
      gland.position.set(0.032, 0.09, 0);
      tag(gland);

      const band = new THREE.Mesh(this.geos.smallBand, catAccent);
      band.rotation.x = Math.PI / 2;
      band.position.y = -0.02;
      tag(band);
    }
    // 5. Ultrasonic Fuel Mass Flow Meter
    else if (id === 'sen_fuel_flow') {
      const block = new THREE.Mesh(this.geos.flowBlock, this.materials.billetAlum);
      tag(block, true);

      for (const dx of [-0.10, 0.10]) {
        const port = new THREE.Mesh(this.geos.spigotCyl, this.materials.titanium);
        port.rotation.z = Math.PI / 2;
        port.position.x = dx;
        tag(port);
      }

      const gland = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
      gland.position.y = 0.055;
      tag(gland);

      const band = new THREE.Mesh(this.geos.accentBand, catAccent);
      band.rotation.y = Math.PI / 2;
      tag(band);
    }
    // 6. FIA Accident Data Recorder (Crash Black Box)
    else if (id === 'sen_adr_crash') {
      const box = new THREE.Mesh(this.geos.adrBox, this.materials.crashOrange);
      tag(box, true);

      const gland = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
      gland.position.set(0.05, 0.06, 0);
      tag(gland);

      const band = new THREE.Mesh(this.geos.accentBand, catAccent);
      band.position.set(-0.04, 0.052, 0);
      tag(band);
    }
    // 7. Dynamic Laser Ride Height Sensor
    else if (id === 'sen_ride_height') {
      const block = new THREE.Mesh(this.geos.laserBox, this.materials.anodizedBlack);
      tag(block, true);

      const lens1 = new THREE.Mesh(this.geos.lensCyl, this.materials.lensGlass);
      lens1.position.set(-0.035, -0.028, 0);
      tag(lens1);
      const lens2 = new THREE.Mesh(this.geos.lensCyl, this.materials.lensGlass);
      lens2.position.set(0.035, -0.028, 0);
      tag(lens2);

      const gland = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
      gland.rotation.z = Math.PI / 2;
      gland.position.set(0.075, 0.01, 0);
      tag(gland);
    }
    // 8. Telemetry RF Blade Antenna
    else if (id === 'sen_telemetry_antenna') {
      const blade = new THREE.Mesh(this.geos.antennaBlade, this.materials.anodizedBlack);
      blade.position.y = 0.12;
      tag(blade, true);

      const base = new THREE.Mesh(this.geos.baseCollar, this.materials.goldBrass);
      tag(base);

      const band = new THREE.Mesh(this.geos.smallBand, catAccent);
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.03;
      tag(band);
    }
    // 9. Tyre Pressure & Temp Wheel Sensor (TPMS)
    else if (id === 'sen_tpms') {
      const pack = new THREE.Mesh(this.geos.tpmsPack, this.materials.anodizedBlack);
      tag(pack, true);

      const stem = new THREE.Mesh(this.geos.valveStem, this.materials.titanium);
      stem.position.y = 0.05;
      tag(stem);

      const cap = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
      cap.position.y = 0.09;
      tag(cap);
    }
    // 10. FIA Standard Electronic Control Unit (SECU)
    else if (id === 'sen_secu') {
      const ecu = new THREE.Mesh(this.geos.ecuChassis, this.materials.billetAlum);
      tag(ecu, true);

      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
        c.rotation.z = Math.PI / 2;
        c.position.set(-0.12, 0, -0.04 + i * 0.04);
        tag(c);
      }
    }
    // 11. Generic High-Precision Motorsport Transducer
    else {
      const body = new THREE.Mesh(this.geos.hexCollar, this.materials.titanium);
      tag(body, true);

      const spigot = new THREE.Mesh(this.geos.spigotCyl, this.materials.steel);
      spigot.position.y = -0.06;
      tag(spigot);

      const gland = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
      gland.position.y = 0.06;
      tag(gland);

      const ring = new THREE.Mesh(this.geos.accentBand, catAccent);
      ring.rotation.x = Math.PI / 2;
      tag(ring);
    }

    // forgiving invisible hit-area so small hardware is easy to hover and click
    const hit = new THREE.Mesh(this.pickGeo, this.pickMat);
    hit.userData = { isSensor: true, isSensorMain: false, sensor, parentPart: part, markerGroup: group, baseScale: 1.0, isPickProxy: true };
    group.add(hit);
    this.markerMeshes.push(hit);
    meshes.push(hit);

    if (DEBUG_SENSORS) {
      const axes = new THREE.AxesHelper(0.12);
      group.add(axes);
    }

    return { meshes, accents };
  }

  initMarkers() {
    for (const sensor of SENSORS) {
      const targets = this.resolveTargets(sensor);
      if (!targets.length) {
        console.warn(`[Sensors] No matching parent part found for sensor ${sensor.id} (${sensor.parentPartId})`);
        continue;
      }

      for (const { part, anchor } of targets) {
        const group = new THREE.Group();
        group.name = `sensor_${sensor.id}`;
        group.position.set(anchor.x, anchor.y, anchor.z);

        const { meshes, accents } = this.buildHardwareModel(sensor, group, part);
        const color = new THREE.Color(SENSOR_CATEGORIES[sensor.category].color);
        const halo = this.makeHalos(group, color);
        part.add(group);

        const marker = {
          group,
          meshes,
          mainMesh: meshes[0],
          sensor,
          parentPart: part,
          accents,
          halo,
          color,
          norm: 0,
          warn: false,
          hot: false,
          seed: Math.random(),
          link: this.makeLink(color),
        };
        this.markers.push(marker);
        this.byGroup.set(group, marker);
        if (sensor.id === 'sen_secu') this.secu = marker;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Live effects                                                       */
  /* ------------------------------------------------------------------ */

  /** Three expanding "heartbeat" rings per sensor; only the first is shown while idle. */
  makeHalos(group, color) {
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.tex.ring,
        color,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sp = new THREE.Sprite(mat);
      sp.renderOrder = 8;
      sp.visible = false;
      sp.raycast = () => {};
      group.add(sp);
      rings.push(sp);
    }
    // rotating dashed reticle, shown only on the selected sensor
    const retMat = new THREE.SpriteMaterial({ map: this.tex.dash, color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false });
    const reticle = new THREE.Sprite(retMat);
    reticle.scale.setScalar(0.34);
    reticle.renderOrder = 9;
    reticle.visible = false;
    reticle.raycast = () => {};
    group.add(reticle);
    return { rings, reticle };
  }

  /** A curved "cable" from a sensor to the ECU, with data pulses travelling along it. */
  makeLink(color) {
    const N = 30;
    const P = 4;
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const line = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P * 3), 3));
    const pts = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({ color: color.clone().lerp(new THREE.Color(0xffffff), 0.55), size: 0.075, map: this.tex.dot, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }),
    );
    for (const o of [line, pts]) {
      o.frustumCulled = false;
      o.visible = false;
      o.renderOrder = 7;
      o.raycast = () => {};
      this.fxRoot.add(o);
    }
    return { line, pts, N, P };
  }

  setEffects(on) {
    this.effects = !!on;
    if (!on) this.clearFx();
    else if (this.active) this.buildFx(this.active);
    this.requestRender();
  }

  setNetwork(on) {
    this.network = !!on;
    this.requestRender();
  }

  /** The marker whose details are open (or null). Drives the reticle, field effect and signal link. */
  setActive(group) {
    const m = group ? this.byGroup.get(group) : null;
    if (this.active === m) return;
    if (this.active) this.active.halo.reticle.visible = false;
    this.clearFx();
    this.active = m || null;
    if (m) {
      m.halo.reticle.visible = true;
      if (this.effects) this.buildFx(m);
    }
    this.requestRender();
  }

  clearFx() {
    if (!this.fx) return;
    for (const o of this.fx.objects) {
      this.fxRoot.remove(o);
      o.geometry?.dispose();
      o.material?.dispose();
    }
    this.fx = null;
  }

  /** Build the 3D "sensing field" for the active marker: what the sensor is actually looking at. */
  buildFx(m) {
    this.clearFx();
    const type = m.sensor.fx || 'pulse';
    const objects = [];
    const add = (o) => {
      o.frustumCulled = false;
      o.raycast = () => {};
      this.fxRoot.add(o);
      objects.push(o);
      return o;
    };
    const fx = { type, objects, marker: m };
    const additive = { transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending };

    if (type === 'laser') {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      fx.beam = add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xff3b30, opacity: 0.95, ...additive })));
      const dg = new THREE.BufferGeometry();
      dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
      fx.dot = add(new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xff8a80, size: 0.06, map: this.tex.dot, sizeAttenuation: true, ...additive })));
      fx.spot = add(new THREE.Mesh(new THREE.RingGeometry(0.015, 0.045, 32), new THREE.MeshBasicMaterial({ color: 0xff3b30, side: THREE.DoubleSide, opacity: 0.9, ...additive })));
      fx.spot.rotation.x = -Math.PI / 2;
    } else if (type === 'ir') {
      const geo = new THREE.ConeGeometry(0.075, 1, 28, 1, true);
      geo.translate(0, -0.5, 0); // apex at the origin, opening along -Y
      fx.cone = add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff7a2f, side: THREE.DoubleSide, opacity: 0.2, ...additive })));
      fx.wire = add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffb27a, wireframe: true, opacity: 0.35, ...additive })));
      fx.target = this.findTarget(m);
    } else if (type === 'airflow') {
      const COUNT = 46;
      const TRAIL = 3;
      const pos = new Float32Array(COUNT * TRAIL * 3);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      fx.points = add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fdcff, size: 0.028, map: this.tex.dot, sizeAttenuation: true, opacity: 0.9, ...additive })));
      fx.seeds = Array.from({ length: COUNT }, (_, i) => ({ a: Math.random() * Math.PI * 2, r: 0.01 + Math.random() * 0.12, t: i / COUNT, s: 0.7 + Math.random() * 0.6 }));
      fx.TRAIL = TRAIL;
    }
    this.fx = fx;
  }

  /** World-space centre of the wheel that a pyrometer is looking at (falls back to straight down). */
  findTarget(m) {
    const id = m.parentPart.userData.partId || m.parentPart.name || '';
    const corner = /-(FL|FR|RL|RR)$/.exec(id)?.[1];
    const rim = corner ? this.reg.parts.get(`rim-${corner}`) : null;
    return rim || null;
  }

  /** Per-frame: advance halos, live glow, field effects and links. Returns true if anything animated. */
  update(dt, sim) {
    this.time += dt;
    const layerOn = !!this.state.layers.sensors;
    if (!layerOn) {
      if (this.fx) this.fx.objects.forEach((o) => (o.visible = false));
      for (const m of this.markers) this.hideLink(m);
      return false;
    }
    let animating = false;
    const t = this.time;
    const activeType = this.fx?.type;

    for (const m of this.markers) {
      const vis = m.group.visible;
      const { rings, reticle } = m.halo;
      if (!vis) {
        for (const r of rings) r.visible = false;
        reticle.visible = false;
        this.hideLink(m);
        continue;
      }
      const isActive = m === this.active;
      const live = m.sensor.live;
      const ch = CHANNELS[live];
      const value = sim.state[live];
      const norm = sim.norm(live);
      m.norm += (norm - m.norm) * (1 - Math.exp(-dt * 10));
      m.warn = !!ch && ((ch.warnHi !== undefined && value > ch.warnHi) || (ch.warnLo !== undefined && value < ch.warnLo));

      // live glow: accent bands brighten with the reading and flash red on an alarm
      const glow = this.effects ? 0.25 + 1.5 * m.norm : 0.45;
      const boost = m.hot || isActive ? 1.55 : 1;
      this._c.copy(m.color);
      if (this.effects && m.warn) this._c.lerp(this._red, 0.5 + 0.5 * Math.sin(t * 14));
      for (const a of m.accents) {
        a.emissiveIntensity = glow * boost;
        a.emissive.copy(this._c);
        a.color.copy(this._c);
      }

      // halos
      if (this.effects) {
        const hz = m.sensor.hz || 100;
        const freq = 0.35 + 0.18 * Math.log10(hz);
        const big = isActive && activeType === 'rf';
        const base = isActive ? (big ? 0.7 : 0.3) : 0.17;
        const span = isActive ? (big ? 2.6 : 1.9) : 1.5;
        const count = isActive ? 3 : 1;
        for (let i = 0; i < 3; i++) {
          const r = rings[i];
          if (i >= count) {
            r.visible = false;
            continue;
          }
          const ph = (t * (big ? freq * 0.7 : freq) + m.seed + i / count) % 1;
          r.visible = true;
          r.scale.setScalar(base * (0.55 + ph * span));
          r.material.opacity = Math.pow(1 - ph, 1.6) * (isActive ? 0.8 : 0.22 + 0.4 * m.norm);
          r.material.color.copy(m.warn ? this._red : m.color);
        }
        if (isActive) {
          reticle.visible = true;
          reticle.material.rotation = t * 0.7;
          const pulse = 1 + 0.06 * Math.sin(t * 5);
          reticle.scale.setScalar(0.3 * pulse);
        }
        animating = true;
      } else {
        for (const r of rings) r.visible = false;
        reticle.visible = isActive;
      }

      // signal link to the ECU
      const showLink = this.secu && m !== this.secu && (this.network || (this.active && (m === this.active || this.active === this.secu)));
      if (showLink) {
        this.updateLink(m, t, isActive || this.active === this.secu);
        animating = true;
      } else this.hideLink(m);
    }

    if (this.fx && this.effects) {
      this.updateFx(t, dt, sim);
      animating = true;
    }
    return animating;
  }

  hideLink(m) {
    if (m.link.line.visible) {
      m.link.line.visible = false;
      m.link.pts.visible = false;
    }
  }

  updateLink(m, t, strong) {
    const { line, pts, N, P } = m.link;
    m.group.getWorldPosition(this._v);
    this.secu.group.getWorldPosition(this._w);
    const a = this._v;
    const b = this._w;
    const lift = 0.28 + 0.18 * a.distanceTo(b);
    const mx = (a.x + b.x) / 2;
    const my = Math.max(a.y, b.y) + lift;
    const mz = (a.z + b.z) / 2 + (a.z >= 0 ? 0.12 : -0.12);
    const arr = line.geometry.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const k0 = (1 - u) * (1 - u);
      const k1 = 2 * (1 - u) * u;
      const k2 = u * u;
      arr[i * 3] = k0 * a.x + k1 * mx + k2 * b.x;
      arr[i * 3 + 1] = k0 * a.y + k1 * my + k2 * b.y;
      arr[i * 3 + 2] = k0 * a.z + k1 * mz + k2 * b.z;
    }
    line.geometry.attributes.position.needsUpdate = true;
    line.material.opacity = strong ? 0.75 : 0.22;
    const hz = m.sensor.hz || 100;
    const speed = 0.22 + 0.16 * Math.log10(hz);
    const parr = pts.geometry.attributes.position.array;
    for (let i = 0; i < P; i++) {
      const u = (t * speed + m.seed + i / P) % 1;
      const k0 = (1 - u) * (1 - u);
      const k1 = 2 * (1 - u) * u;
      const k2 = u * u;
      parr[i * 3] = k0 * a.x + k1 * mx + k2 * b.x;
      parr[i * 3 + 1] = k0 * a.y + k1 * my + k2 * b.y;
      parr[i * 3 + 2] = k0 * a.z + k1 * mz + k2 * b.z;
    }
    pts.geometry.attributes.position.needsUpdate = true;
    pts.material.size = strong ? 0.085 : 0.05;
    line.visible = true;
    pts.visible = true;
  }

  updateFx(t, dt, sim) {
    const fx = this.fx;
    const m = fx.marker;
    const vis = m.group.visible;
    fx.objects.forEach((o) => (o.visible = vis));
    if (!vis) return;
    m.group.getWorldPosition(this._v);
    const p = this._v;

    if (fx.type === 'laser') {
      const gy = 0.012;
      const arr = fx.beam.geometry.attributes.position.array;
      arr.set([p.x, p.y, p.z, p.x, gy, p.z]);
      fx.beam.geometry.attributes.position.needsUpdate = true;
      const u = (t * 1.8) % 1;
      fx.dot.geometry.attributes.position.array.set([p.x, p.y + (gy - p.y) * u, p.z]);
      fx.dot.geometry.attributes.position.needsUpdate = true;
      fx.spot.position.set(p.x, gy, p.z);
      // the spot "breathes" with the ride height: low ride height = tight, bright spot
      const rh = sim.norm('rideHeight');
      fx.spot.scale.setScalar(0.8 + 0.8 * rh + 0.15 * Math.sin(t * 9));
    } else if (fx.type === 'ir') {
      const target = fx.target ? new THREE.Box3().setFromObject(fx.target).getCenter(this._w) : this._w.set(p.x, p.y - 0.35, p.z);
      const dir = target.clone().sub(p);
      const len = Math.max(0.05, dir.length());
      dir.normalize();
      for (const o of [fx.cone, fx.wire]) {
        o.position.copy(p);
        o.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
        o.scale.set(1, len, 1);
      }
      // hotter reading = brighter cone
      fx.cone.material.opacity = 0.12 + 0.3 * m.norm + 0.04 * Math.sin(t * 8);
    } else if (fx.type === 'airflow') {
      const arr = fx.points.geometry.attributes.position.array;
      const spd = 0.25 + 0.9 * sim.norm('airspeed');
      const TRAIL = fx.TRAIL;
      fx.seeds.forEach((sd, i) => {
        sd.t = (sd.t + dt * spd * sd.s) % 1;
        for (let k = 0; k < TRAIL; k++) {
          const tt = sd.t - k * 0.018 * (0.4 + spd);
          const u = tt < 0 ? tt + 1 : tt;
          const spread = 1 + 3.2 * smooth(0.45, 1, u);
          const r = sd.r * spread;
          const j = (i * TRAIL + k) * 3;
          arr[j] = p.x + 0.95 - u * 1.9;
          arr[j + 1] = p.y + Math.sin(sd.a) * r;
          arr[j + 2] = p.z + Math.cos(sd.a) * r;
        }
      });
      fx.points.geometry.attributes.position.needsUpdate = true;
    }
  }
  matchesFilter(sensor) {
    if (this.filterCategory !== 'all' && sensor.category !== this.filterCategory) {
      return false;
    }
    if (this.filterAuthority !== 'all' && sensor.authority !== this.filterAuthority) {
      return false;
    }
    return true;
  }

  setFilters({ category, authority }) {
    if (category !== undefined) this.filterCategory = category;
    if (authority !== undefined) this.filterAuthority = authority;
    this.syncVisibility();
    this.requestRender();
  }

  syncVisibility() {
    const sensorsLayerOn = !!this.state.layers.sensors;

    for (const m of this.markers) {
      const parentLayer = m.parentPart.userData.layer;
      const parentLayerOn = this.state.layers[parentLayer] !== false;
      const parentVisible = m.parentPart.visible;
      const filterMatch = this.matchesFilter(m.sensor);

      const visible = sensorsLayerOn && parentLayerOn && parentVisible && filterMatch;
      m.group.visible = visible;
    }
  }

  pick(raycaster) {
    if (!this.state.layers.sensors) return null;

    const activeTargets = [];
    for (const mesh of this.markerMeshes) {
      if (mesh.parent && mesh.parent.visible && mesh.visible) {
        activeTargets.push(mesh);
      }
    }

    if (!activeTargets.length) return null;
    const hits = raycaster.intersectObjects(activeTargets, false);
    if (!hits.length) return null;

    const hitMesh = hits[0].object;
    const { sensor, parentPart, markerGroup } = hitMesh.userData;

    return {
      isSensor: true,
      sensor,
      part: parentPart,
      marker: markerGroup,
      point: hits[0].point,
    };
  }

  highlight(markerGroup, isHighlighted) {
    if (!markerGroup) return;
    const m = this.byGroup.get(markerGroup);
    if (m) m.hot = !!isHighlighted;
    markerGroup.traverse((obj) => {
      if (obj.isMesh && obj.userData.isSensor && !obj.userData.isPickProxy) {
        obj.scale.setScalar(isHighlighted ? 1.25 : obj.userData.baseScale || 1.0);
      }
    });
  }

  /** All markers for one sensor (e.g. the four wheel-speed sensors). */
  markersFor(sensor) {
    return this.markers.filter((m) => m.sensor === sensor);
  }

  dispose() {
    this.clearFx();
    for (const g of Object.values(this.geos)) g.dispose();
    for (const m of Object.values(this.materials)) m.dispose();
    for (const m of this.markers) {
      m.accents.forEach((a) => a.dispose());
      m.halo.rings.forEach((r) => r.material.dispose());
      m.link.line.geometry.dispose();
      m.link.line.material.dispose();
      m.link.pts.geometry.dispose();
      m.link.pts.material.dispose();
    }
    Object.values(this.tex).forEach((t) => t.dispose());
    this.pickGeo.dispose();
    this.pickMat.dispose();
    this.scene.remove(this.fxRoot);
    this.markers = [];
    this.markerMeshes = [];
    this.byGroup.clear();
  }
}

/* ---------- small helpers ---------- */

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function canvasTexture(draw, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRingTexture() {
  return canvasTexture((g, n) => {
    const h = n / 2;
    const grd = g.createRadialGradient(h, h, 0, h, h, h);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.62, 'rgba(255,255,255,0)');
    grd.addColorStop(0.82, 'rgba(255,255,255,1)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, n, n);
  });
}

function makeDotTexture() {
  return canvasTexture((g, n) => {
    const h = n / 2;
    const grd = g.createRadialGradient(h, h, 0, h, h, h);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, n, n);
  }, 64);
}

function makeDashTexture() {
  return canvasTexture((g, n) => {
    const h = n / 2;
    g.strokeStyle = '#fff';
    g.lineWidth = 3.5;
    g.lineCap = 'round';
    g.setLineDash([14, 10]);
    g.beginPath();
    g.arc(h, h, h - 8, 0, Math.PI * 2);
    g.stroke();
  }, 128);
}
