/* ---------------------------------------------------------------------------
   WORKER SIMULATOR
   1) A citizen reports garbage  2) The admin assigns the job
   3) YOU (the worker) clean it with the joystick   4) You take a photo and upload it
   5) The admin watches on CCTV and approves / rejects (done in the Flutter app)
--------------------------------------------------------------------------- */
(function () {
  'use strict';
  const $ = CS.$;
  const Cleaner = (window.Cleaner = {});

  const N_ITEMS = 14; // pieces of garbage to clean
  const REACH = 1.9; // how close you must stand to sweep a piece
  const SWEEP_TIME = 0.55; // seconds of sweeping needed per piece
  const BOUNDS = { x0: -12.5, x1: 12.5, z0: -5.5, z1: 7.5 };
  const START = new THREE.Vector3(3.5, 0, 5.5);
  // circles the worker cannot walk through: [x, z, radius]
  const OBSTACLES = [[7.6, -1.6, 1.6], [-9, -6.6, 2.2], [6, -5.2, 0.5], [-12, 6.2, 0.9], [12, 6.2, 0.9], [11.5, -4.8, 0.9]];

  Cleaner.start = function (data) {
    data = data || {};
    const stage = CS.createStage($('stage'));
    const scene = stage.scene;
    const camera = stage.camera;

    // =============================================================== WORLD
    const ground = CS.flat(CS.box(140, 0.2, 100, 0x6fa356));
    ground.position.set(0, -0.1, -12);
    scene.add(ground);
    const plaza = CS.flat(CS.box(30, 0.24, 20, 0x9c9c94));
    plaza.position.set(0, -0.08, 0);
    scene.add(plaza);

    // the dirty patch fades away as the area gets cleaner
    const dirtMat = new THREE.MeshStandardMaterial({ color: 0x5d4a3a, transparent: true, opacity: 0.75, roughness: 1 });
    const dirt = new THREE.Mesh(new THREE.CircleGeometry(6.6, 30), dirtMat);
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.y = 0.06;
    dirt.receiveShadow = true;
    scene.add(dirt);

    // road + curb + lane markings
    scene.add(CS.at(CS.flat(CS.box(140, 0.2, 7, 0x44474c)), 0, -0.1, -13.5));
    scene.add(CS.at(CS.flat(CS.box(140, 0.3, 0.5, 0xe0e0e0)), 0, 0.05, -10.1));
    for (let x = -60; x < 60; x += 4.5) scene.add(CS.at(CS.flat(CS.box(2.2, 0.02, 0.22, 0xfdd835)), x, 0.01, -13.5));

    // buildings behind the road
    const rb = CS.rng(5);
    const pastel = [0xffcc80, 0x90caf9, 0xa5d6a7, 0xf48fb1, 0xb39ddb, 0xffe082];
    for (let i = 0; i < 7; i++) {
      const w = 8 + rb() * 5;
      const h = 9 + rb() * 10;
      scene.add(CS.at(CS.building(w, h, 8, pastel[i % pastel.length], rb), -36 + i * 12.5, 0, -24));
    }

    // trees, street lamp, bus stop, dumpster
    const rt = CS.rng(21);
    [[-12, 6.2, 1.1], [12, 6.2, 1.2], [11.5, -4.8, 1], [-16, 9, 1.0], [-20, -3, 1.3], [21, -2, 1.3], [-22, 6, 1.2]].forEach((t) =>
      scene.add(CS.at(CS.tree(rt, t[2]), t[0], 0, t[1]))
    );
    scene.add(CS.at(CS.lamp(false), 6, 0, -5.2));
    scene.add(CS.at(CS.lamp(false), -2, 0, -5.2));

    const shelter = new THREE.Group();
    shelter.add(CS.at(CS.box(4.4, 0.15, 1.8, 0x546e7a), 0, 2.7, 0));
    shelter.add(CS.at(CS.box(0.12, 2.7, 0.12, 0x546e7a), -2.1, 1.35, 0.8));
    shelter.add(CS.at(CS.box(0.12, 2.7, 0.12, 0x546e7a), 2.1, 1.35, 0.8));
    shelter.add(CS.at(CS.box(4.2, 1.9, 0.06, 0x80deea, { transparent: true, opacity: 0.45 }), 0, 1.65, -0.8));
    shelter.add(CS.at(CS.box(3.2, 0.12, 0.5, 0x8d6e63), 0, 0.6, -0.5));
    shelter.add(CS.at(CS.box(0.9, 0.5, 0.06, 0xd32f2f), 1.5, 3.1, 0.8));
    scene.add(CS.at(shelter, -9, 0, -6.6));

    const dumpster = new THREE.Group();
    dumpster.add(CS.at(CS.box(2.4, 1.3, 1.3, 0x2e7d32), 0, 0.75, 0));
    dumpster.add(CS.at(CS.box(2.55, 0.12, 1.45, 0x1b5e20), 0, 1.45, 0));
    [-1, 1].forEach((s) => dumpster.add(CS.at(CS.cyl(0.14, 0.14, 0.12, 0x212121, 8), s * 0.9, 0.14, 0.7)));
    scene.add(CS.at(dumpster, 7.6, 0, -1.6));

    // moving traffic
    const cars = [
      { m: CS.car(0xe53935), z: -12.2, dir: 1, speed: 7, x: -30 },
      { m: CS.car(0x1e88e5), z: -14.8, dir: -1, speed: 5.5, x: 30 },
      { m: CS.car(0xfdd835), z: -12.2, dir: 1, speed: 6, x: 25 },
    ];
    cars.forEach((c) => {
      c.m.position.set(c.x, 0, c.z);
      c.m.rotation.y = c.dir > 0 ? 0 : Math.PI;
      scene.add(c.m);
    });

    // CCTV pole that the admin "watches" you through at the end
    const cam = CS.cctv();
    cam.position.set(-12.5, 0, 8.2);
    cam.userData.head.rotation.y = Math.atan2(12.5, -8.2);
    scene.add(cam);

    // =============================================================== PEOPLE
    const citizen = CS.person({ shirt: 0xe91e63, pants: 0x3949ab, phone: true });
    citizen.userData.armRFixed = true;
    citizen.userData.armR.rotation.x = -1.35;
    citizen.position.set(-6.2, 0, 3.2);
    citizen.rotation.y = Math.atan2(6.2, -3.2);
    scene.add(citizen);

    const worker = CS.person({ shirt: 0x0d47a1, pants: 0x263238, vest: true, helmet: true, broom: true });
    worker.position.set(16, 0, -8.8);
    scene.add(worker);

    // pin floating above the garbage
    const pin = CS.label('', { w: 360, h: 76, scale: 4.2, font: 'bold 32px sans-serif' });
    pin.position.set(0, 3.6, 0);
    pin.visible = false;
    scene.add(pin);

    // target rings (show which piece you are about to sweep)
    const ringBase = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 28), new THREE.MeshBasicMaterial({ color: 0xffeb3b, side: THREE.DoubleSide }));
    ringBase.rotation.x = -Math.PI / 2;
    ringBase.visible = false;
    scene.add(ringBase);
    const ringFill = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: 0x66bb6a, transparent: true, opacity: 0.75 }));
    ringFill.rotation.x = -Math.PI / 2;
    ringFill.visible = false;
    scene.add(ringFill);

    // =============================================================== GARBAGE
    let items = [];
    let runCount = 0;
    function spawnItems() {
      items.forEach((it) => scene.remove(it));
      items = [];
      const rand = CS.rng(11 + runCount * 7);
      let guard = 0;
      while (items.length < N_ITEMS && guard++ < 600) {
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * 5.9;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (OBSTACLES.some((o) => Math.hypot(x - o[0], z - o[1]) < o[2] + 0.8)) continue;
        if (items.some((it) => Math.hypot(x - it.position.x, z - it.position.z) < 1.5)) continue;
        const it = CS.garbageItem(CS.GARBAGE_KINDS[Math.floor(rand() * CS.GARBAGE_KINDS.length)], rand);
        it.position.set(x, 0.05, z);
        it.userData.progress = 0;
        it.userData.done = false;
        it.userData.fly = -1;
        scene.add(it);
        items.push(it);
      }
    }

    // ============================================================ GAME STATE
    let phase = 'intro'; // intro | clean | photo | preview | uploading | done
    let introT = 0;
    let flashed = false;
    let stage2 = false;
    let cleaned = 0;
    let runStart = 0;
    let finalSeconds = 0;
    let capturedImage = null;
    const input = { x: 0, y: 0, sweep: false };
    let target = null;
    let path = [];
    let citizenPath = [];
    const fx = [];
    const camGoal = { pos: new THREE.Vector3(0, 26, 30), look: new THREE.Vector3(0, 0, 0) };
    const camLook = new THREE.Vector3(0, 0, 0);
    camera.position.copy(camGoal.pos);
    let camLambda = 2.2;
    let fovGoal = 52;

    const show = (id, on) => {
      const el = $(id);
      if (el) el.classList.toggle('hidden', !on);
    };
    const say = (html) => {
      const b = $('banner');
      b.innerHTML = html;
      b.classList.remove('pop');
      void b.offsetWidth;
      b.classList.add('pop');
      b.classList.remove('hidden');
    };
    const setStep = (n) => {
      document.querySelectorAll('#steps span').forEach((s) => {
        const k = Number(s.dataset.step);
        s.classList.toggle('on', k === n);
        s.classList.toggle('done', k < n);
      });
    };
    const flash = () => {
      const f = $('flash');
      f.classList.remove('go');
      void f.offsetWidth;
      f.classList.add('go');
    };
    const fmt = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    const updateProgress = () => {
      $('bar').style.width = (cleaned / N_ITEMS) * 100 + '%';
      $('ptext').textContent = cleaned + ' / ' + N_ITEMS + ' cleaned';
      dirtMat.opacity = 0.75 * (1 - cleaned / N_ITEMS);
    };

    function puff(pos) {
      for (let i = 0; i < 5; i++) {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 6, 5),
          new THREE.MeshBasicMaterial({ color: 0xf5f5f5, transparent: true, opacity: 0.8 })
        );
        m.position.set(pos.x + (Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 0.4, pos.z + (Math.random() - 0.5) * 0.6);
        m.userData = { life: 0, vx: (Math.random() - 0.5) * 1.4, vz: (Math.random() - 0.5) * 1.4 };
        scene.add(m);
        fx.push(m);
      }
    }

    function resetRun(skipIntro) {
      runCount++;
      cleaned = 0;
      spawnItems();
      updateProgress();
      worker.position.copy(START);
      worker.rotation.y = Math.PI;
      citizen.visible = !skipIntro;
      pin.visible = true;
      pin.userData.set('IN PROGRESS', '#1e88e5');
      $('prev-msg').textContent = '';
      show('preview', false);
      show('cctv-final', false);
      show('viewfinder', false);
      show('btn-photo', false);
      show('joy', true);
      show('btn-clean', true);
      show('progress', true);
      show('skip', false);
      setStep(3);
      say('<b>③ Your turn!</b> Move with the joystick. Stand next to garbage and <b>hold CLEAN</b>.');
      phase = 'clean';
      fovGoal = 52;
      runStart = performance.now();
      camLambda = 4;
    }

    // ============================================================== INTRO
    spawnItems();
    updateProgress();
    stage.onResize = () => {};
    setStep(1);
    say('<b>① A citizen</b> spots a pile of garbage on the street…');
    show('skip', true);
    camGoal.pos.set(-0.2, 4.2, 8.2);
    camGoal.look.set(-5.2, 1.3, 2.4);

    function finishIntro() {
      citizen.visible = false;
      worker.position.copy(START);
      worker.rotation.y = Math.PI;
      pin.userData.set('IN PROGRESS', '#1e88e5');
      show('skip', false);
      show('joy', true);
      show('btn-clean', true);
      show('progress', true);
      setStep(3);
      say('<b>③ Your turn!</b> Move with the joystick. Stand next to garbage and <b>hold CLEAN</b>.');
      phase = 'clean';
      runStart = performance.now();
      camLambda = 4;
    }
    $('skip').onclick = () => {
      if (phase === 'intro') finishIntro();
    };

    function walkAlong(obj, pts, dt, t, speed) {
      if (!pts.length) {
        CS.idleAnim(obj, t);
        return;
      }
      const p = pts[0];
      const dx = p.x - obj.position.x;
      const dz = p.z - obj.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.12) {
        pts.shift();
        return;
      }
      obj.position.x += (dx / d) * speed * dt;
      obj.position.z += (dz / d) * speed * dt;
      obj.rotation.y = CS.lerpAngle(obj.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt));
      CS.walkAnim(obj, 1, t);
    }

    function introUpdate(dt, t) {
      introT += dt;
      if (introT > 1.5 && !flashed) {
        flashed = true;
        flash();
        pin.visible = true;
        pin.userData.set('📷 REPORT SENT', '#00897b');
        say('The citizen <b>photographs it</b> and sends a report with the GPS location.');
      }
      if (introT > 3.1 && flashed && !stage2) {
        pin.userData.set('⚠ REPORTED', '#e53935');
      }
      if (introT > 4.3 && !stage2) {
        stage2 = true;
        setStep(2);
        say('<b>② The admin assigns</b> the job to you. You are on your way…');
        pin.userData.set('ASSIGNED', '#fb8c00');
        citizen.userData.armRFixed = false;
        citizenPath = [new THREE.Vector3(-17, 0, 5.5)];
        path = [new THREE.Vector3(14, 0, -8.8), new THREE.Vector3(14, 0, 5.5), START.clone()];
        worker.position.set(16, 0, -8.8);
        camGoal.pos.set(4, 12, 19);
        camGoal.look.set(3, 0.5, 1);
      }
      if (stage2) {
        walkAlong(worker, path, dt, t, 4.4);
        walkAlong(citizen, citizenPath, dt, t, 2.6);
        if (!path.length && introT > 7.2) finishIntro();
      } else {
        CS.idleAnim(worker, t);
        citizen.userData.armR.rotation.x = -1.35 + Math.sin(t * 2) * 0.03;
      }
      camLambda = 2.4;
    }

    // ================================================================ CLEAN
    function cleanUpdate(dt, t) {
      let mx = input.x;
      let mz = input.y;
      const mag = Math.min(1, Math.hypot(mx, mz));
      // find the nearest piece of garbage within reach
      target = null;
      let best = 1e9;
      items.forEach((it) => {
        if (it.userData.done) return;
        const d = Math.hypot(it.position.x - worker.position.x, it.position.z - worker.position.z);
        if (d < REACH && d < best) {
          best = d;
          target = it;
        }
      });
      const sweeping = input.sweep && phase === 'clean';

      if (mag > 0.08 && phase === 'clean') {
        const len = Math.hypot(mx, mz);
        mx /= len;
        mz /= len;
        const sp = 5.2 * mag;
        worker.position.x = CS.clamp(worker.position.x + mx * sp * dt, BOUNDS.x0, BOUNDS.x1);
        worker.position.z = CS.clamp(worker.position.z + mz * sp * dt, BOUNDS.z0, BOUNDS.z1);
        OBSTACLES.forEach((o) => {
          const dx = worker.position.x - o[0];
          const dz = worker.position.z - o[1];
          const d = Math.hypot(dx, dz);
          if (d < o[2] + 0.45) {
            worker.position.x = o[0] + (dx / d) * (o[2] + 0.45);
            worker.position.z = o[1] + (dz / d) * (o[2] + 0.45);
          }
        });
        worker.rotation.y = CS.lerpAngle(worker.rotation.y, Math.atan2(mx, mz), 1 - Math.exp(-12 * dt));
        if (sweeping && target) CS.sweepAnim(worker, t);
        else CS.walkAnim(worker, mag, t);
      } else if (sweeping && target) {
        // face the garbage while sweeping
        const ang = Math.atan2(target.position.x - worker.position.x, target.position.z - worker.position.z);
        worker.rotation.y = CS.lerpAngle(worker.rotation.y, ang, 1 - Math.exp(-12 * dt));
        CS.sweepAnim(worker, t);
      } else {
        CS.idleAnim(worker, t);
      }

      // sweeping progress
      if (target && phase === 'clean') {
        ringBase.visible = true;
        ringBase.position.set(target.position.x, 0.09, target.position.z);
        if (sweeping) {
          target.userData.progress += dt / SWEEP_TIME;
          target.rotation.z = Math.sin(t * 38) * 0.12;
          ringFill.visible = true;
          ringFill.position.set(target.position.x, 0.1, target.position.z);
          ringFill.scale.setScalar(Math.max(0.05, target.userData.progress));
          if (target.userData.progress >= 1) collect(target);
        } else {
          ringFill.visible = false;
        }
      } else {
        ringBase.visible = false;
        ringFill.visible = false;
      }

      // pieces flying into the worker's bag
      items.forEach((it) => {
        if (it.userData.fly >= 0) {
          it.userData.fly += dt / 0.4;
          const f = Math.min(1, it.userData.fly);
          it.position.x += (worker.position.x - it.position.x) * Math.min(1, dt * 9);
          it.position.z += (worker.position.z - it.position.z) * Math.min(1, dt * 9);
          it.position.y = 0.05 + Math.sin(f * Math.PI) * 1.2 + f * 0.6;
          it.scale.setScalar(Math.max(0.01, 1 - f));
          if (f >= 1) {
            scene.remove(it);
            it.userData.fly = -2;
          }
        }
      });

      // follow camera
      camGoal.pos.set(worker.position.x * 0.9, 9.5, worker.position.z + 10.5);
      camGoal.look.set(worker.position.x * 0.9, 0.4, worker.position.z - 1.5);
    }

    function collect(it) {
      it.userData.done = true;
      it.userData.fly = 0;
      it.rotation.z = 0;
      cleaned++;
      puff(it.position);
      updateProgress();
      if (cleaned >= N_ITEMS) {
        finalSeconds = (performance.now() - runStart) / 1000;
        pin.userData.set('✔ CLEAN', '#43a047');
        show('btn-clean', false);
        show('btn-photo', true);
        setStep(4);
        say('<b>④ All clean!</b> Now take a <b>photo as proof</b> and upload it.');
      }
    }

    // =============================================================== PHOTO
    $('btn-photo').onclick = () => {
      if (phase !== 'clean' || cleaned < N_ITEMS) return;
      phase = 'photo';
      input.x = input.y = 0;
      input.sweep = false;
      show('joy', false);
      show('btn-photo', false);
      show('progress', false);
      show('viewfinder', true);
      pin.visible = false;
      ringBase.visible = ringFill.visible = false;
      worker.position.set(2.6, 0, 2.4);
      worker.rotation.y = Math.PI * 0.9;
      // pull the camera back far enough that the whole cleaned circle fits, even on a narrow phone screen
      fovGoal = 66;
      const tanH = Math.tan((33 * Math.PI) / 180) * Math.min(camera.aspect, 1.6);
      const dist = Math.max(17, 8 / tanH);
      camGoal.look.set(0, 0, 0.5);
      camGoal.pos.set(0, dist * 0.6, 0.5 + dist * 0.8);
      camLambda = 3;
      say('Frame the cleaned area, then tap the shutter.');
    };

    function capture() {
      const src = stage.dom;
      const sc = Math.min(1, 960 / src.width);
      const cv = document.createElement('canvas');
      cv.width = Math.round(src.width * sc);
      cv.height = Math.round(src.height * sc);
      const ctx = cv.getContext('2d');
      ctx.drawImage(src, 0, 0, cv.width, cv.height);
      const bar = Math.max(26, Math.round(cv.height * 0.035));
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, cv.height - bar, cv.width, bar);
      ctx.fillStyle = '#fff';
      ctx.font = Math.round(bar * 0.5) + 'px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('CleanCity SIMULATION  |  ' + new Date().toLocaleString() + '  |  cleaned ' + cleaned + '/' + N_ITEMS, 10, cv.height - bar / 2);
      return cv.toDataURL('image/jpeg', 0.85);
    }

    $('btn-shutter').onclick = () => {
      if (phase !== 'photo') return;
      flash();
      capturedImage = capture();
      $('prev-img').src = capturedImage;
      $('prev-msg').textContent = '';
      $('btn-upload').disabled = false;
      $('btn-retake').disabled = false;
      show('viewfinder', false);
      show('preview', true);
      phase = 'preview';
    };
    $('btn-retake').onclick = () => {
      if (phase !== 'preview') return;
      show('preview', false);
      show('viewfinder', true);
      phase = 'photo';
    };
    $('btn-upload').onclick = () => {
      if (phase !== 'preview' || !capturedImage) return;
      phase = 'uploading';
      $('btn-upload').disabled = true;
      $('btn-retake').disabled = true;
      $('prev-msg').textContent = 'Uploading to the server…';
      CS.send({
        type: 'photo',
        image: capturedImage,
        itemsCleaned: cleaned,
        totalItems: N_ITEMS,
        durationSec: Math.round(finalSeconds),
        scenario: data.scenario || 'Garbage clean-up training',
      });
      // when running in a plain browser (no Flutter) pretend the upload worked
      if (!(window.Flutter && window.Flutter.postMessage)) setTimeout(() => Cleaner.uploadResult(true, 'test mode'), 700);
    };

    /** Flutter calls this after it tried to upload the photo to the server. */
    Cleaner.uploadResult = function (ok, msg) {
      if (phase !== 'uploading') return;
      if (!ok) {
        phase = 'preview';
        $('btn-upload').disabled = false;
        $('btn-retake').disabled = false;
        $('prev-msg').textContent = msg || 'Upload failed. Try again.';
        return;
      }
      phase = 'done';
      show('preview', false);
      show('cctv-final', true);
      setStep(5);
      say('<b>⑤ Submitted!</b> The admin is watching on CCTV and will approve or reject your work.');
      pin.visible = true;
      pin.userData.set('PENDING REVIEW', '#8e24aa');
      const head = cam.userData.head;
      const camPos = new THREE.Vector3(-12.5, 5.3, 8.2);
      const dir = new THREE.Vector3(12.5, 0, -8.2).normalize();
      camGoal.pos.copy(camPos).addScaledVector(dir, 1.3);
      camGoal.look.set(0, 0.8, 0);
      camLambda = 2;
      head.rotation.y = Math.atan2(dir.x, dir.z);
    };
    $('btn-again').onclick = () => {
      if (phase === 'done') resetRun(true);
    };
    $('btn-close').onclick = () => CS.send({ type: 'close' });

    // ================================================================ INPUT
    const joy = $('joy');
    const knob = $('knob');
    let joyId = null;
    const joyMove = (e) => {
      const r = joy.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const max = r.width / 2 - 14;
      const d = Math.hypot(dx, dy);
      if (d > max) {
        dx = (dx / d) * max;
        dy = (dy / d) * max;
      }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      input.x = dx / max;
      input.y = dy / max;
    };
    const joyEnd = () => {
      joyId = null;
      knob.style.transform = 'translate(0,0)';
      input.x = input.y = 0;
    };
    joy.addEventListener('pointerdown', (e) => {
      joyId = e.pointerId;
      joy.setPointerCapture(e.pointerId);
      joyMove(e);
    });
    joy.addEventListener('pointermove', (e) => {
      if (e.pointerId === joyId) joyMove(e);
    });
    joy.addEventListener('pointerup', joyEnd);
    joy.addEventListener('pointercancel', joyEnd);

    const cleanBtn = $('btn-clean');
    cleanBtn.addEventListener('pointerdown', (e) => {
      cleanBtn.setPointerCapture(e.pointerId);
      input.sweep = true;
      cleanBtn.classList.add('held');
    });
    const sweepEnd = () => {
      input.sweep = false;
      cleanBtn.classList.remove('held');
    };
    cleanBtn.addEventListener('pointerup', sweepEnd);
    cleanBtn.addEventListener('pointercancel', sweepEnd);

    const keys = {};
    const keyVec = () => {
      input.x = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
      input.y = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
    };
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        input.sweep = true;
        e.preventDefault();
      }
      keys[e.code] = true;
      keyVec();
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') input.sweep = false;
      keys[e.code] = false;
      keyVec();
    });

    // ================================================================= LOOP
    setInterval(() => {
      if (phase === 'clean') $('timer').textContent = '⏱ ' + fmt((performance.now() - runStart) / 1000);
      const c = $('cctv-clock');
      if (c) c.textContent = new Date().toLocaleString();
    }, 500);

    stage.onFrame((dt, t) => {
      // traffic
      cars.forEach((c) => {
        c.m.position.x += c.dir * c.speed * dt;
        if (c.m.position.x > 38) c.m.position.x = -38;
        if (c.m.position.x < -38) c.m.position.x = 38;
      });
      // CCTV pan + blinking LED
      if (phase !== 'done') cam.userData.head.rotation.y = Math.atan2(12.5, -8.2) + Math.sin(t * 0.6) * 0.35;
      cam.userData.led.visible = Math.floor(t * 2) % 2 === 0;
      // pin gently bobs
      pin.position.y = 3.6 + Math.sin(t * 2.4) * 0.12;

      if (phase === 'intro') introUpdate(dt, t);
      else if (phase === 'clean') cleanUpdate(dt, t);
      else if (phase === 'photo' || phase === 'preview' || phase === 'uploading') {
        CS.idleAnim(worker, t);
      } else if (phase === 'done') {
        CS.idleAnim(worker, t);
        worker.userData.armL.rotation.x = -2.6 + Math.sin(t * 6) * 0.35; // waving
      }

      // puffs
      for (let i = fx.length - 1; i >= 0; i--) {
        const m = fx[i];
        m.userData.life += dt;
        const k = m.userData.life / 0.6;
        m.position.x += m.userData.vx * dt;
        m.position.z += m.userData.vz * dt;
        m.position.y += dt * 0.8;
        m.scale.setScalar(1 + k * 2.2);
        m.material.opacity = Math.max(0, 0.8 * (1 - k));
        if (k >= 1) {
          scene.remove(m);
          fx.splice(i, 1);
        }
      }

      // camera
      const k = 1 - Math.exp(-camLambda * dt);
      camera.position.lerp(camGoal.pos, k);
      camLook.lerp(camGoal.look, k);
      camera.lookAt(camLook);
      if (Math.abs(camera.fov - fovGoal) > 0.05) {
        camera.fov = CS.damp(camera.fov, fovGoal, 4, dt);
        camera.updateProjectionMatrix();
      }
    });

    // handy hooks for testing in a browser console
    Cleaner.debug = {
      state: () => ({ phase, cleaned, introT, items: items.length }),
      skipIntro: () => finishIntro(),
      setInput: (x, y, sweep) => {
        input.x = x;
        input.y = y;
        input.sweep = !!sweep;
      },
      teleport: (x, z) => worker.position.set(x, 0, z),
      items: () => items.filter((i) => !i.userData.done).map((i) => [i.position.x, i.position.z]),
      collectAll: () => items.forEach((it) => !it.userData.done && collect(it)),
      step: (sec) => {
        for (let i = 0; i < sec * 30; i++) stage.updaters.forEach((fn) => fn(1 / 30, stage.time + i / 30));
      },
    };
  };
})();
