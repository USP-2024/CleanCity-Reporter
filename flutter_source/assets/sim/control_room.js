/* ---------------------------------------------------------------------------
   ADMIN CONTROL ROOM  ("digital twin" of the city)
   - 6 ward plots + a training ground, each watched by a 3D CCTV camera
   - every REAL report from the database shows up as a marker: garbage piles,
     potholes, puddles... with the right colour for its status
   - workers are drawn sweeping where a report is "In progress"
   - tap a marker  -> the report opens in the Flutter app
   - tap a camera  -> you see that camera's "live feed"
   - pending worker simulations appear as purple screens in the training ground
   This is a visualisation of the database, NOT a real video feed.
--------------------------------------------------------------------------- */
(function () {
  'use strict';
  const $ = CS.$;
  const CR = (window.ControlRoom = {});

  const WARDS = ['Ward A', 'Ward B', 'Ward C', 'Ward D', 'Ward E', 'Ward F'];
  const PLOT_W = 14;
  const PLOT_D = 11;
  const SLOTS = [[-4.4, -1.0], [0, -1.0], [4.4, -1.0], [-4.4, 2.6], [0, 2.6], [4.4, 2.6]];

  // 2 columns x 3 rows of wards, training ground in front
  const PLOTS = WARDS.map((name, i) => ({
    name: name,
    x: i % 2 === 0 ? -8.8 : 8.8,
    z: -13.5 + Math.floor(i / 2) * 13.5,
    outer: i % 2 === 0 ? -1 : 1,
    sim: false,
  }));
  PLOTS.push({ name: 'TRAINING GROUND', x: 0, z: 27, outer: -1, sim: true });

  let stage, scene, camera;
  let dyn = null; // group that is rebuilt every time the data changes
  let anim = []; // per-frame animations of the dynamic content
  let pickIssues = [];
  let pickSims = [];
  const pickCams = [];
  const cams = []; // {idx, plot, group, feedPos, look, baseYaw}
  let data = { reports: [], simulations: [] };
  let lastSig = '';
  let train = null; // auto-replay worker in the training ground
  const plotGroups = [];
  const titleLabels = []; // plot names (hidden in camera feeds)
  let issueLabels = []; // status labels above markers (smaller in camera feeds)

  // camera state
  let mode = 'overview';
  let feedIdx = -1;
  const orbit = { theta: 0, phi: 0.92, radius: 80, target: new THREE.Vector3(0, 0, 12) };
  let yawOff = 0;
  let pitchOff = 0;
  let fovGoal = 55;
  let transition = 0;
  const goalPos = new THREE.Vector3();
  const goalLook = new THREE.Vector3();
  const camLook = new THREE.Vector3();

  // ------------------------------------------------------------------ props
  function prop(cat, rand) {
    const g = new THREE.Group();
    if (cat === 'garbage') {
      g.add(CS.garbagePile(6, rand, 0.95));
    } else if (cat === 'pothole') {
      g.add(CS.at(CS.cyl(0.85, 0.85, 0.05, 18, 18, { roughness: 1 }), 0, 0.17, 0));
      g.children[0].material.color.set(0x050505);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const r = CS.box(0.22, 0.14, 0.2, 0x6d6d6d);
        r.position.set(Math.cos(a) * 1.0, 0.2, Math.sin(a) * 1.0);
        r.rotation.y = a;
        g.add(r);
      }
    } else if (cat === 'waterlogging') {
      const w = CS.cyl(1.3, 1.3, 0.06, 0x2979ff, 24, { transparent: true, opacity: 0.65, emissive: 0x0d3c9c, emissiveIntensity: 0.6 });
      w.position.y = 0.19;
      g.add(w);
    } else if (cat === 'streetlight') {
      const l = CS.lamp(false);
      l.rotation.z = 0.38;
      l.scale.setScalar(0.7);
      g.add(l);
      g.add(CS.at(CS.box(0.9, 0.12, 0.5, 0x546e7a), 0.9, 0.2, 0.4));
    } else {
      [[-0.4, 0.2], [0.5, -0.3]].forEach((p) => {
        const c = CS.cone(0.28, 0.75, 0xff6d00, 8);
        c.position.set(p[0], 0.55, p[1]);
        g.add(c);
        g.add(CS.at(CS.cyl(0.3, 0.3, 0.08, 0xffffff, 8), p[0], 0.5, p[1]));
      });
      g.add(CS.at(CS.box(0.8, 0.45, 0.6, 0x8d6e63), 0.1, 0.4, 0.8));
    }
    return g;
  }

  function bush() {
    const g = new THREE.Group();
    g.add(CS.at(CS.sphere(0.5, 0x2e7d32, {}, 8), 0, 0.5, 0));
    [[0.3, 0.8], [-0.3, 0.7], [0.1, 0.95]].forEach((p) => g.add(CS.at(CS.sphere(0.1, 0xffeb3b, { emissive: 0x665500 }, 5), p[0], p[1], 0.35)));
    return g;
  }

  function issue(r, k) {
    const rand = CS.rng(1000 + k * 17 + r.id.length);
    const g = new THREE.Group();
    const status = r.status;
    const color = CS.COLORS[status] || 0x9e9e9e;
    const resolved = status === 'resolved';

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.45, 1.72, 32),
      new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide, transparent: true, opacity: resolved ? 0.55 : 0.95 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.2;
    g.add(ring);
    if (status === 'reported' || status === 'pending_review') {
      anim.push((dt, t) => {
        const s = 1 + Math.sin(t * 4 + k) * 0.1;
        ring.scale.set(s, s, s);
        ring.material.opacity = 0.6 + Math.sin(t * 4 + k) * 0.35;
      });
    }

    if (resolved) g.add(bush());
    else g.add(prop(r.category, rand));

    // people
    if (status === 'assigned' || status === 'in_progress' || status === 'pending_review') {
      const w = CS.person({ shirt: 0x1565c0, vest: true, helmet: true, broom: status === 'in_progress', phone: status === 'pending_review' });
      w.position.set(1.9, 0.15, 0.7);
      w.rotation.y = Math.atan2(-1.9, -0.7);
      if (status === 'pending_review') {
        w.userData.armRFixed = true;
        w.userData.armR.rotation.x = -1.35;
      }
      g.add(w);
      if (status === 'in_progress') anim.push((dt, t) => CS.sweepAnim(w, t + k));
      else anim.push((dt, t) => CS.idleAnim(w, t + k));
    }

    if (!resolved) {
      const lb = CS.label(CS.STATUS_TEXT[status] || status, { bg: CS.CSS_COLORS[status] || '#546e7a', w: 300, h: 64, scale: 2.4, font: 'bold 28px sans-serif' });
      lb.position.set(0, 2.9, 0);
      g.add(lb);
      issueLabels.push({ sp: lb, base: lb.scale.clone() });
    }

    const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 3.4, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 1.7;
    hit.userData.reportId = r.id;
    pickIssues.push(hit);
    g.add(hit);
    return g;
  }

  // ------------------------------------------------------------------ build
  function buildWorld() {
    const rand = CS.rng(3);
    const ground = CS.flat(CS.box(160, 0.2, 130, 0x121c2a));
    ground.position.set(0, -0.1, 10);
    scene.add(ground);
    const grid = new THREE.GridHelper(160, 80, 0x2b4560, 0x1b2d42);
    grid.position.set(0, 0.03, 10);
    scene.add(grid);

    PLOTS.forEach((p, i) => {
      const pg = new THREE.Group();
      pg.position.set(p.x, 0, p.z);
      scene.add(pg);
      plotGroups.push(pg);

      pg.add(CS.flat(CS.at(CS.box(PLOT_W, 0.3, PLOT_D, p.sim ? 0x2b2a45 : 0x22364b), 0, 0, 0)));
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(PLOT_W, 0.3, PLOT_D)),
        new THREE.LineBasicMaterial({ color: p.sim ? 0xba68c8 : 0x4dd0e1 })
      );
      pg.add(edges);

      const title = CS.label(p.sim ? 'TRAINING GROUND' : p.name.toUpperCase(), {
        bg: p.sim ? '#6a1b9a' : '#00695c',
        w: 400,
        h: 72,
        scale: 5.6,
        font: p.sim ? 'bold 30px sans-serif' : 'bold 34px sans-serif',
      });
      title.position.set(0, 1.0, PLOT_D / 2 + 0.6);
      pg.add(title);
      titleLabels.push(title);

      // glowing lamps at the front corners, tree at the back
      pg.add(CS.at(CS.lamp(true), -6.5, 0.15, 4.9));
      const l2 = CS.lamp(true);
      l2.scale.x = -1;
      pg.add(CS.at(l2, 6.5, 0.15, 4.9));
      pg.add(CS.at(CS.tree(rand, 0.75), -p.outer * 6.1, 0.15, -4.7));

      // CCTV camera on the back corner
      const cam = CS.cctv(8.5);
      const px = p.outer * 6.1;
      const pz = -4.6;
      cam.position.set(px, 0.15, pz);
      pg.add(cam);
      const baseYaw = Math.atan2(-px, 1.2 - pz);
      cam.userData.head.rotation.y = baseYaw;
      const dirLen = Math.hypot(-px, 1.2 - pz);
      const feedPos = new THREE.Vector3(p.x + px + ((-px) / dirLen) * 1.4, 8.65, p.z + pz + ((1.2 - pz) / dirLen) * 1.4);
      const look = new THREE.Vector3(p.x - p.outer * 0.4, 0.2, p.z + 1.6);
      cam.traverse((o) => {
        if (o.isMesh) {
          o.userData.camIndex = i;
          pickCams.push(o);
        }
      });
      cams.push({ idx: i, plot: p, group: cam, baseYaw: baseYaw, feedPos: feedPos, look: look });
    });

    // ---- training ground: an automatic "replay" worker cleaning, again and again
    const pg = plotGroups[plotGroups.length - 1];
    const worker = CS.person({ shirt: 0x0d47a1, pants: 0x263238, vest: true, helmet: true, broom: true });
    pg.add(worker);
    const lab = CS.label('🧹 AUTO REPLAY', { bg: '#37474f', w: 340, h: 64, scale: 3.2, font: 'bold 28px sans-serif' });
    lab.position.set(0, 3.0, 0);
    worker.add(lab);
    train = { group: pg, worker: worker, label: lab, items: [], state: 'seek', timer: 0, target: null, runs: 0 };
    trainReset();
  }

  function trainReset() {
    train.items.forEach((it) => train.group.remove(it));
    train.items = [];
    const rand = CS.rng(77 + train.runs++ * 13);
    for (let i = 0; i < 9; i++) {
      const it = CS.garbageItem(CS.GARBAGE_KINDS[Math.floor(rand() * CS.GARBAGE_KINDS.length)], rand);
      it.position.set(-5 + rand() * 10, 0.15, -3 + rand() * 6.6);
      train.group.add(it);
      train.items.push(it);
    }
    train.worker.position.set(-6, 0.15, 3.5);
  }

  function trainUpdate(dt, t) {
    const w = train.worker;
    if (train.state === 'seek') {
      let best = null;
      let bd = 1e9;
      train.items.forEach((it) => {
        const d = Math.hypot(it.position.x - w.position.x, it.position.z - w.position.z);
        if (d < bd) {
          bd = d;
          best = it;
        }
      });
      if (!best) {
        train.state = 'wait';
        train.timer = 3;
        return;
      }
      if (bd < 1.0) {
        train.state = 'sweep';
        train.timer = 0.9;
        train.target = best;
      } else {
        const dx = best.position.x - w.position.x;
        const dz = best.position.z - w.position.z;
        w.position.x += (dx / bd) * 2.9 * dt;
        w.position.z += (dz / bd) * 2.9 * dt;
        w.rotation.y = CS.lerpAngle(w.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt));
        CS.walkAnim(w, 1, t);
      }
    } else if (train.state === 'sweep') {
      CS.sweepAnim(w, t);
      train.timer -= dt;
      const it = train.target;
      if (it) it.rotation.z = Math.sin(t * 36) * 0.12;
      if (train.timer <= 0 && it) {
        train.group.remove(it);
        train.items.splice(train.items.indexOf(it), 1);
        train.target = null;
        train.state = 'seek';
      }
    } else {
      CS.idleAnim(w, t);
      w.userData.armL.rotation.x = -2.6 + Math.sin(t * 6) * 0.35;
      train.timer -= dt;
      if (train.timer <= 0) {
        trainReset();
        train.state = 'seek';
      }
    }
  }

  // dynamic content: reports + pending simulations
  function buildDynamic() {
    if (dyn) {
      scene.remove(dyn);
      CS.dispose(dyn);
    }
    dyn = new THREE.Group();
    scene.add(dyn);
    anim = [];
    pickIssues = [];
    pickSims = [];
    issueLabels = [];

    const order = { reported: 0, pending_review: 1, in_progress: 2, assigned: 3, resolved: 4 };
    const byWard = {};
    WARDS.forEach((w) => (byWard[w] = []));
    (data.reports || []).forEach((r) => {
      if (byWard[r.ward]) byWard[r.ward].push(r);
    });

    PLOTS.forEach((p, i) => {
      if (p.sim) return;
      const list = byWard[p.name].slice().sort((a, b) => (order[a.status] || 9) - (order[b.status] || 9));
      const g = new THREE.Group();
      g.position.set(p.x, 0.15, p.z);
      dyn.add(g);
      list.slice(0, SLOTS.length).forEach((r, k) => {
        const it = issue(r, k + i * 7);
        it.position.set(SLOTS[k][0], 0, SLOTS[k][1]);
        g.add(it);
      });
      if (list.length > SLOTS.length) {
        const more = CS.label('+' + (list.length - SLOTS.length) + ' more', { bg: '#455a64', w: 240, h: 56, scale: 2.2, font: 'bold 26px sans-serif' });
        more.position.set(5.6, 0.8, 4.6);
        g.add(more);
      }
    });

    // pending simulations: purple screens in the training ground
    const sp = PLOTS[PLOTS.length - 1];
    const sg = new THREE.Group();
    sg.position.set(sp.x, 0.15, sp.z);
    dyn.add(sg);
    const pending = (data.simulations || []).filter((s) => s.status === 'pending').slice(0, 4);
    pending.forEach((s, i) => {
      const m = new THREE.Group();
      m.position.set(-4.8 + i * 3.2, 0, 3.9);
      m.add(CS.at(CS.cyl(0.08, 0.1, 1.4, 0x607d8b, 6), 0, 0.7, 0));
      const screen = CS.box(1.7, 1.05, 0.1, 0x7b1fa2, { emissive: 0x7b1fa2, emissiveIntensity: 0.9 });
      screen.position.set(0, 1.7, 0);
      m.add(screen);
      m.add(CS.at(CS.box(1.5, 0.85, 0.02, 0xce93d8, { emissive: 0xce93d8, emissiveIntensity: 0.7 }), 0, 1.7, 0.07));
      const first = (s.workerName || 'Worker').split(' ')[0];
      const lb = CS.label('📷 ' + first + ' ' + s.itemsCleaned + '/' + s.totalItems, { bg: '#8e24aa', w: 340, h: 64, scale: 3.0, font: 'bold 28px sans-serif' });
      lb.position.set(0, 2.9, 0);
      m.add(lb);
      anim.push((dt, t) => {
        screen.material.emissiveIntensity = 0.6 + Math.sin(t * 3 + i) * 0.4;
        lb.position.y = 2.9 + Math.sin(t * 2.4 + i) * 0.1;
      });
      const hit = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.4, 1.4), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 1.7;
      hit.userData.simId = s.id;
      pickSims.push(hit);
      m.add(hit);
      sg.add(m);
    });

    const last = (data.simulations || [])[0];
    train.label.userData.set(last ? '🧹 ' + (last.workerName || 'Worker').split(' ')[0] + ' · REPLAY' : '🧹 AUTO REPLAY', '#37474f');
    applyLabelMode();
    renderTop();
    renderCamStats();
  }

  // ------------------------------------------------------------------- HUD
  function counts(list) {
    const c = { reported: 0, assigned: 0, in_progress: 0, pending_review: 0, resolved: 0 };
    list.forEach((r) => {
      if (c[r.status] !== undefined) c[r.status]++;
    });
    return c;
  }
  function renderTop() {
    const c = counts(data.reports || []);
    const pendSims = (data.simulations || []).filter((s) => s.status === 'pending').length;
    const chip = (label, n, col) => '<span style="--c:' + col + '">' + label + ' ' + n + '</span>';
    $('cr-counts').innerHTML =
      chip('Reported', c.reported, CS.CSS_COLORS.reported) +
      chip('Assigned', c.assigned, CS.CSS_COLORS.assigned) +
      chip('In progress', c.in_progress, CS.CSS_COLORS.in_progress) +
      chip('Review', c.pending_review, CS.CSS_COLORS.pending_review) +
      chip('Resolved', c.resolved, CS.CSS_COLORS.resolved) +
      chip('Sim reviews', pendSims, '#ce93d8');
  }
  function renderCamStats() {
    if (feedIdx < 0) return;
    const p = cams[feedIdx].plot;
    if (p.sim) {
      const pend = (data.simulations || []).filter((s) => s.status === 'pending').length;
      $('cam-stats').innerHTML = 'SIMULATION AREA<br>Pending reviews: ' + pend;
      return;
    }
    const c = counts((data.reports || []).filter((r) => r.ward === p.name));
    const open = c.reported + c.assigned + c.in_progress;
    $('cam-stats').innerHTML = 'OPEN ' + open + ' · REVIEW ' + c.pending_review + '<br>RESOLVED ' + c.resolved;
  }
  function buildCamBar() {
    const bar = $('cam-bar');
    bar.innerHTML = '';
    const add = (label, idx, cls) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.dataset.idx = idx;
      if (cls) b.className = cls;
      b.onclick = () => (idx < 0 ? selectOverview() : selectCam(idx));
      bar.appendChild(b);
    };
    add('🏙 Overview', -1);
    cams.forEach((c) => add('CAM ' + (c.idx + 1) + ' · ' + (c.plot.sim ? 'SIM' : c.plot.name.replace('Ward ', 'Ward ')), c.idx, c.plot.sim ? 'sim' : ''));
    markBar();
  }
  function markBar() {
    document.querySelectorAll('#cam-bar button').forEach((b) => b.classList.toggle('on', Number(b.dataset.idx) === feedIdx));
  }

  function applyLabelMode() {
    const feed = mode === 'feed';
    titleLabels.forEach((t) => (t.visible = !feed));
    issueLabels.forEach((l) => l.sp.scale.set(l.base.x * (feed ? 0.55 : 1), l.base.y * (feed ? 0.55 : 1), 1));
  }

  function selectOverview() {
    mode = 'overview';
    feedIdx = -1;
    yawOff = pitchOff = 0;
    fovGoal = 55;
    transition = 1.2;
    applyLabelMode();
    $('cam-overlay').classList.add('hidden');
    $('cr-top').classList.remove('hidden');
    $('cr-hint').textContent = 'Drag to rotate · pinch to zoom · tap a camera or a marker';
    markBar();
  }
  function selectCam(i) {
    mode = 'feed';
    feedIdx = i;
    yawOff = pitchOff = 0;
    fovGoal = camera.aspect < 0.7 ? 78 : 62; // wider view on a narrow phone screen
    transition = 1.2;
    applyLabelMode();
    const p = cams[i].plot;
    $('cam-name').textContent = 'CAM ' + String(i + 1).padStart(2, '0') + ' · ' + p.name.toUpperCase();
    $('cam-overlay').classList.remove('hidden');
    $('cr-top').classList.add('hidden');
    $('cr-hint').textContent = 'Drag to look around · tap a marker to open it';
    renderCamStats();
    markBar();
  }

  // where the camera wants to be (overview orbit or a CCTV feed)
  const UP = new THREE.Vector3(0, 1, 0);
  function computeGoal() {
    if (mode === 'overview') {
      const o = orbit;
      goalPos.set(
        o.target.x + o.radius * Math.sin(o.phi) * Math.sin(o.theta),
        o.target.y + o.radius * Math.cos(o.phi),
        o.target.z + o.radius * Math.sin(o.phi) * Math.cos(o.theta)
      );
      goalLook.copy(o.target);
    } else {
      const c = cams[feedIdx];
      goalPos.copy(c.feedPos);
      const dir = c.look.clone().sub(c.feedPos).normalize();
      dir.applyAxisAngle(UP, yawOff);
      const right = new THREE.Vector3().crossVectors(dir, UP).normalize();
      dir.applyAxisAngle(right, pitchOff);
      goalLook.copy(c.feedPos).addScaledVector(dir, 12);
    }
  }
  // while the finger is moving, follow it immediately (no easing), so dragging feels direct
  function snapCamera() {
    computeGoal();
    camera.position.copy(goalPos);
    camLook.copy(goalLook);
    camera.lookAt(camLook);
    transition = 0;
    if (Math.abs(camera.fov - fovGoal) > 0.01) {
      camera.fov = fovGoal;
      camera.updateProjectionMatrix();
    }
  }

  // ----------------------------------------------------------------- input
  function setupInput() {
    const dom = stage.dom;
    const pts = new Map();
    let down = null;
    let pinchPrev = 0;
    const pinchDist = () => {
      const a = Array.from(pts.values());
      return a.length < 2 ? 0 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
    };
    const zoom = (ratio) => {
      if (mode === 'overview') orbit.radius = CS.clamp(orbit.radius * ratio, 22, 100);
      else fovGoal = CS.clamp(fovGoal * ratio, 30, 90);
      snapCamera();
    };
    dom.addEventListener('pointerdown', (e) => {
      try {
        dom.setPointerCapture(e.pointerId);
      } catch (err) {
        /* not supported: ignore */
      }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
      else {
        if (down) down.moved = true;
        pinchPrev = pinchDist();
      }
    });
    dom.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pts.size === 1) {
        if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) down.moved = true;
        if (mode === 'overview') {
          orbit.theta -= dx * 0.006;
          orbit.phi = CS.clamp(orbit.phi - dy * 0.005, 0.3, 1.38);
        } else {
          yawOff = CS.clamp(yawOff + dx * 0.004, -1.0, 1.0);
          pitchOff = CS.clamp(pitchOff - dy * 0.003, -0.6, 0.5);
        }
        if (down && down.moved) snapCamera();
      } else if (pts.size === 2) {
        const d = pinchDist();
        if (pinchPrev > 0 && d > 0) zoom(pinchPrev / d);
        pinchPrev = d;
      }
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (down && !down.moved && performance.now() - down.t < 600) pick(e.clientX, e.clientY);
      if (pts.size === 0) down = null;
    };
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', (e) => {
      pts.delete(e.pointerId);
      down = null;
    });
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoom(1 + e.deltaY * 0.001);
    }, { passive: false });

    const ray = new THREE.Raycaster();
    function pick(cx, cy) {
      const r = dom.getBoundingClientRect();
      const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      let hit = ray.intersectObjects(pickIssues, false)[0];
      if (hit) return CS.send({ type: 'openReport', id: hit.object.userData.reportId });
      hit = ray.intersectObjects(pickSims, false)[0];
      if (hit) return CS.send({ type: 'openSimulation', id: hit.object.userData.simId });
      hit = ray.intersectObjects(pickCams, false)[0];
      if (hit && mode === 'overview') selectCam(hit.object.userData.camIndex);
    }
    CR._pick = pick;
  }

  // ----------------------------------------------------------------- start
  CR.start = function (initial) {
    stage = CS.createStage($('stage'), {
      sky: 0x0b1524,
      fogNear: 90,
      fogFar: 210,
      hemi: 0.75,
      hemiSky: 0x9fb4ff,
      hemiGround: 0x1c2a40,
      sun: 0.6,
      sunColor: 0xb7c9ff,
      preserve: false,
    });
    scene = stage.scene;
    camera = stage.camera;
    camera.fov = 55;
    camera.updateProjectionMatrix();

    buildWorld();
    buildCamBar();
    setupInput();
    let nv = false;
    $('btn-nv').onclick = () => {
      nv = !nv;
      if (CS.LOW) {
        // cheap version: tint the lights and sky green (a CSS filter on the canvas is too slow on phones)
        scene.background.set(nv ? 0x031a0a : 0x0b1524);
        scene.fog.color.set(nv ? 0x031a0a : 0x0b1524);
        stage.hemi.color.set(nv ? 0x80ff9a : 0x9fb4ff);
        stage.sun.color.set(nv ? 0x80ff9a : 0xb7c9ff);
      } else {
        stage.dom.classList.toggle('nv', nv);
      }
      $('btn-nv').textContent = nv ? '🌙 Night vision ON' : '🌙 Night vision';
    };

    stage.onResize = () => {
      // fit the whole city on screen, also on a narrow phone
      const tanV = Math.tan((camera.fov * Math.PI) / 360);
      const fit = 17.5 / (tanV * Math.min(camera.aspect, 1.3));
      orbit.radius = CS.clamp(fit, 42, 80);
    };
    stage.onResize();

    CR.update(initial || {});
    camera.position.set(0, 60, 80);
    camLook.copy(orbit.target);

    setInterval(() => {
      $('cam-clock').textContent = new Date().toLocaleString();
    }, 1000);

    stage.onFrame((dt, t) => {
      // CCTV heads sweep slowly, LEDs blink
      cams.forEach((c, i) => {
        const h = c.group.userData.head;
        h.rotation.y = c.baseYaw + Math.sin(t * 0.5 + i) * 0.4;
        c.group.userData.led.visible = Math.floor(t * 2 + i) % 2 === 0;
      });
      anim.forEach((fn) => fn(dt, t));
      trainUpdate(dt, t);

      // camera
      if (transition > 0) transition -= dt;
      const lambda = transition > 0 ? 3 : 9;
      computeGoal();
      const k = 1 - Math.exp(-lambda * dt);
      camera.position.lerp(goalPos, k);
      camLook.lerp(goalLook, k);
      camera.lookAt(camLook);
      if (Math.abs(camera.fov - fovGoal) > 0.05) {
        camera.fov = CS.damp(camera.fov, fovGoal, 5, dt);
        camera.updateProjectionMatrix();
      }
    });

    CR.debug = {
      selectCam: selectCam,
      overview: selectOverview,
      step: (sec) => {
        for (let i = 0; i < sec * 30; i++) stage.updaters.forEach((fn) => fn(1 / 30, stage.time + i / 30));
      },
      orbit: orbit,
      screenOfIssue: (i) => {
        const v = new THREE.Vector3().setFromMatrixPosition(pickIssues[i].matrixWorld).project(camera);
        const r = stage.dom.getBoundingClientRect();
        return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
      },
      screenOfCam: (i) => {
        const v = new THREE.Vector3(cams[i].group.getWorldPosition(new THREE.Vector3()).x, 3, cams[i].group.getWorldPosition(new THREE.Vector3()).z).project(camera);
        const r = stage.dom.getBoundingClientRect();
        return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
      },
      pick: (x, y) => CR._pick(x, y),
      mode: () => mode + ':' + feedIdx,
      quality: () => stage.quality,
      pickables: () => ({ issues: pickIssues.length, sims: pickSims.length, cams: pickCams.length }),
    };
  };

  /** Flutter sends fresh data (reports + simulations) every few seconds. */
  CR.update = function (d) {
    if (!train) return;
    const next = { reports: (d && d.reports) || [], simulations: (d && d.simulations) || [] };
    const sig = JSON.stringify(next);
    if (sig === lastSig) return; // nothing changed: skip the expensive redraw
    lastSig = sig;
    data = next;
    buildDynamic();
  };

  // sample data so the scene can be tested in a plain browser: index.html?mode=control_room
  window.__demoData = function () {
    const cats = ['garbage', 'pothole', 'waterlogging', 'streetlight', 'other', 'garbage'];
    const st = ['reported', 'assigned', 'in_progress', 'pending_review', 'resolved', 'reported', 'resolved', 'reported'];
    const reports = [];
    for (let i = 0; i < 20; i++) reports.push({ id: 'r' + i, title: 'Report ' + i, ward: WARDS[i % 6], status: st[(i * 3) % st.length], category: cats[i % cats.length] });
    return {
      reports: reports,
      simulations: [
        { id: 's1', workerName: 'Ramesh Patil', status: 'pending', itemsCleaned: 14, totalItems: 14 },
        { id: 's2', workerName: 'Sunita Jadhav', status: 'pending', itemsCleaned: 14, totalItems: 14 },
      ],
    };
  };
})();
