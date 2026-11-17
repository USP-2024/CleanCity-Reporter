/* ---------------------------------------------------------------------------
   CleanCity 3D - shared building blocks (Three.js r149)
   People, garbage, CCTV cameras, trees, labels, and the scene/renderer set-up.
   Everything is made from simple shapes (low-poly), so there are no model files.
--------------------------------------------------------------------------- */
(function () {
  'use strict';
  const CS = (window.CS = {});

  CS.COLORS = {
    reported: 0xe53935,
    assigned: 0xfb8c00,
    in_progress: 0x1e88e5,
    pending_review: 0x8e24aa,
    resolved: 0x43a047,
  };
  CS.CSS_COLORS = {
    reported: '#e53935',
    assigned: '#fb8c00',
    in_progress: '#1e88e5',
    pending_review: '#8e24aa',
    resolved: '#43a047',
  };
  CS.STATUS_TEXT = {
    reported: 'REPORTED',
    assigned: 'ASSIGNED',
    in_progress: 'IN PROGRESS',
    pending_review: 'REVIEW',
    resolved: 'CLEAN',
  };

  // Phones and the Android emulator: render lighter (no shadows / anti-aliasing, 1x resolution, 30 fps).
  // Force it in a desktop browser with  index.html?mode=...&low=1
  CS.LOW = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || /[?&]low=1/.test(location.search);
  document.documentElement.classList.toggle('low', CS.LOW); // lets the CSS drop expensive effects

  CS.$ = (id) => document.getElementById(id);
  CS.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  CS.lerpAngle = function (a, b, k) {
    const d = ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
    return a + d * k;
  };
  // small seeded random generator so scenes look the same every time
  CS.rng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };

  /** Send a message to the Flutter app (or just log it when testing in a browser). */
  CS.send = function (obj) {
    const text = JSON.stringify(obj);
    if (window.Flutter && typeof window.Flutter.postMessage === 'function') {
      window.Flutter.postMessage(text);
    } else {
      (window.__sent = window.__sent || []).push(obj);
      console.log('[to Flutter]', text.length > 160 ? text.slice(0, 160) + '...' : text);
    }
  };

  // ------------------------------------------------------------------ meshes
  CS.mat = (color, o) =>
    new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.9, metalness: 0.0, flatShading: true }, o || {}));
  CS.mesh = function (geo, color, o) {
    const m = new THREE.Mesh(geo, CS.mat(color, o));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  CS.box = (w, h, d, color, o) => CS.mesh(new THREE.BoxGeometry(w, h, d), color, o);
  CS.cyl = (rt, rb, h, color, seg, o) => CS.mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), color, o);
  CS.cone = (r, h, color, seg, o) => CS.mesh(new THREE.ConeGeometry(r, h, seg || 8), color, o);
  CS.sphere = (r, color, o, seg) => CS.mesh(new THREE.SphereGeometry(r, seg || 10, (seg || 10) - 2), color, o);
  CS.at = (obj, x, y, z) => {
    obj.position.set(x, y, z);
    return obj;
  };
  CS.flat = (m) => {
    m.castShadow = false;
    return m;
  };

  // ------------------------------------------------------------------ labels
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  /** Floating text label (a Sprite that always faces the camera). sprite.userData.set(text, bgColor) changes it. */
  CS.label = function (text, o) {
    o = Object.assign({ bg: '#c62828', fg: '#ffffff', font: 'bold 30px sans-serif', w: 320, h: 72, scale: 2.8 }, o || {});
    const cv = document.createElement('canvas');
    cv.width = o.w;
    cv.height = o.h;
    const ctx = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.scale.set(o.scale, (o.scale * o.h) / o.w, 1);
    sp.renderOrder = 10;
    sp.userData.set = function (t, bg) {
      ctx.clearRect(0, 0, o.w, o.h);
      ctx.fillStyle = bg || o.bg;
      roundRect(ctx, 3, 3, o.w - 6, o.h - 6, 18);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.stroke();
      ctx.fillStyle = o.fg;
      ctx.font = o.font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t, o.w / 2, o.h / 2 + 2);
      tex.needsUpdate = true;
    };
    sp.userData.set(text);
    return sp;
  };

  // ------------------------------------------------------------------ people
  /** A low-poly person, about 1.9 m tall, facing +z. */
  CS.person = function (o) {
    o = Object.assign(
      { shirt: 0x1e88e5, pants: 0x37474f, skin: 0xf1c27d, hair: 0x3e2723, vest: false, helmet: false, phone: false, broom: false },
      o || {}
    );
    const g = new THREE.Group();
    const limb = (w, h, d, color, x, y) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      const m = CS.box(w, h, d, color);
      m.position.y = -h / 2;
      pivot.add(m);
      g.add(pivot);
      return pivot;
    };
    const legL = limb(0.22, 0.85, 0.24, o.pants, -0.14, 0.85);
    const legR = limb(0.22, 0.85, 0.24, o.pants, 0.14, 0.85);
    const torso = CS.at(CS.box(0.58, 0.7, 0.32, o.shirt), 0, 1.2, 0);
    g.add(torso);
    if (o.vest) {
      g.add(CS.at(CS.box(0.62, 0.5, 0.36, 0xffa000, { emissive: 0x552b00 }), 0, 1.27, 0));
      if (!CS.LOW) [1.13, 1.33].forEach((y) => g.add(CS.at(CS.box(0.64, 0.06, 0.38, 0xf5f5f5, { emissive: 0x999999 }), 0, y, 0)));
    }
    const head = CS.at(CS.sphere(0.19, o.skin), 0, 1.72, 0);
    g.add(head);
    if (o.helmet) {
      const hel = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), CS.mat(0xffca28));
      hel.castShadow = true;
      hel.position.y = 1.75;
      g.add(hel);
      g.add(CS.at(CS.box(0.46, 0.04, 0.3, 0xffca28), 0, 1.75, 0.08));
    } else {
      g.add(CS.at(CS.box(0.36, 0.12, 0.38, o.hair), 0, 1.87, -0.01));
    }
    const armL = limb(0.14, 0.62, 0.16, o.shirt, -0.37, 1.52);
    const armR = limb(0.14, 0.62, 0.16, o.shirt, 0.37, 1.52);
    if (!CS.LOW) [armL, armR].forEach((a) => a.add(CS.at(CS.box(0.14, 0.14, 0.16, o.skin), 0, -0.66, 0)));
    if (o.phone) {
      const ph = CS.at(CS.box(0.12, 0.2, 0.03, 0x111111), 0, -0.7, 0.12);
      armR.add(ph);
      armR.add(CS.at(CS.box(0.09, 0.16, 0.01, 0x66ccff, { emissive: 0x3399ff }), 0, -0.7, 0.14));
    }
    if (o.broom) {
      const br = new THREE.Group();
      br.position.set(0, -0.66, 0.1);
      br.rotation.x = -0.35;
      br.add(CS.at(CS.cyl(0.025, 0.025, 1.3, 0x8d6e63, 6), 0, -0.4, 0.0));
      br.add(CS.at(CS.box(0.38, 0.1, 0.16, 0xd4a64a), 0, -1.0, 0.0));
      armR.add(br);
      g.userData.broom = br;
    }
    g.userData.legL = legL;
    g.userData.legR = legR;
    g.userData.armL = armL;
    g.userData.armR = armR;
    g.userData.torso = torso;
    return g;
  };
  // keeps the broom pointing roughly at the ground while the arm swings
  function syncBroom(p) {
    const u = p.userData;
    if (u.broom) u.broom.rotation.x = -u.armR.rotation.x * 0.8 - 0.3;
  }
  CS.walkAnim = function (p, amount, t) {
    const u = p.userData;
    const s = Math.sin(t * 11) * 0.8 * amount;
    u.legL.rotation.x = s;
    u.legR.rotation.x = -s;
    u.armL.rotation.x = -s * 0.9;
    if (!u.armRFixed) u.armR.rotation.x = s * 0.9;
    u.torso.rotation.x = 0.06 * amount;
    syncBroom(p);
  };
  CS.idleAnim = function (p, t) {
    const u = p.userData;
    u.legL.rotation.x = 0;
    u.legR.rotation.x = 0;
    u.armL.rotation.x = Math.sin(t * 1.6) * 0.04;
    if (!u.armRFixed) u.armR.rotation.x = Math.sin(t * 1.6 + 1) * 0.04;
    u.torso.rotation.x = 0;
    syncBroom(p);
  };
  CS.sweepAnim = function (p, t) {
    const u = p.userData;
    const s = Math.sin(t * 9);
    u.legL.rotation.x = 0.15;
    u.legR.rotation.x = -0.15;
    u.armR.rotation.x = -0.95 + s * 0.5;
    u.armL.rotation.x = -0.7 - s * 0.35;
    u.torso.rotation.x = 0.28 + s * 0.06;
    syncBroom(p);
  };

  // ----------------------------------------------------------------- garbage
  CS.GARBAGE_KINDS = ['bag', 'bag', 'bagw', 'box', 'box', 'bottle', 'bottle', 'can', 'tire'];
  /** One piece of litter. userData.kind tells what it is. */
  CS.garbageItem = function (kind, rand) {
    rand = rand || Math.random;
    const g = new THREE.Group();
    g.userData.kind = kind;
    if (kind === 'bag' || kind === 'bagw') {
      const c = kind === 'bag' ? 0x1b1b1b : 0xeceff1;
      const b = CS.at(CS.sphere(0.34, c, { roughness: 0.35 }), 0, 0.27, 0);
      b.scale.set(1, 0.8, 1);
      g.add(b);
      g.add(CS.at(CS.cone(0.09, 0.2, c, 6), 0, 0.64, 0));
    } else if (kind === 'box') {
      g.add(CS.at(CS.box(0.58, 0.36, 0.46, 0xb08a5a), 0, 0.18, 0));
      g.add(CS.at(CS.box(0.6, 0.04, 0.2, 0x8d6e4a), 0, 0.37, 0.12));
    } else if (kind === 'bottle') {
      const b = CS.cyl(0.075, 0.075, 0.34, 0x4fc3f7, 8, { transparent: true, opacity: 0.85 });
      b.rotation.z = Math.PI / 2;
      b.position.y = 0.08;
      g.add(b);
      const cap = CS.cyl(0.04, 0.04, 0.06, 0x1565c0, 6);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(0.19, 0.08, 0);
      g.add(cap);
    } else if (kind === 'can') {
      const b = CS.cyl(0.07, 0.07, 0.17, 0xcfd8dc, 8, { metalness: 0.5, roughness: 0.4 });
      b.rotation.z = Math.PI / 2;
      b.position.y = 0.07;
      g.add(b);
      g.add(CS.at(CS.box(0.1, 0.012, 0.1, 0xe53935), 0, 0.15, 0));
    } else {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.13, 8, 14), CS.mat(0x212121));
      t.castShadow = true;
      t.rotation.x = Math.PI / 2;
      t.position.y = 0.13;
      g.add(t);
    }
    g.rotation.y = rand() * Math.PI * 2;
    return g;
  };
  CS.garbagePile = function (n, rand, radius) {
    rand = rand || Math.random;
    const g = new THREE.Group();
    if (CS.LOW) n = Math.max(3, Math.ceil(n * 0.7));
    for (let i = 0; i < n; i++) {
      const it = CS.garbageItem(CS.GARBAGE_KINDS[Math.floor(rand() * CS.GARBAGE_KINDS.length)], rand);
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * radius;
      it.position.set(Math.cos(a) * r, i > 3 ? 0.25 : 0, Math.sin(a) * r);
      g.add(it);
    }
    return g;
  };

  // -------------------------------------------------------------- street kit
  CS.cctv = function (h) {
    h = h || 5.2;
    const g = new THREE.Group();
    g.add(CS.at(CS.cyl(0.38, 0.45, 0.3, 0x455a64, 10), 0, 0.15, 0));
    g.add(CS.at(CS.cyl(0.1, 0.14, h, 0x607d8b, 8), 0, h / 2, 0));
    const head = new THREE.Group();
    head.position.set(0, h + 0.1, 0);
    g.add(head);
    head.add(CS.at(CS.box(0.4, 0.34, 0.9, 0xeceff1), 0, 0.1, 0.45));
    head.add(CS.at(CS.box(0.5, 0.05, 1.0, 0x90a4ae), 0, 0.3, 0.45));
    const lens = CS.cyl(0.13, 0.13, 0.12, 0x111111, 10);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0.1, 0.94);
    head.add(lens);
    const glass = CS.cyl(0.08, 0.08, 0.02, 0x2196f3, 10, { emissive: 0x0d47a1 });
    glass.rotation.x = Math.PI / 2;
    glass.position.set(0, 0.1, 1.01);
    head.add(glass);
    const led = CS.at(CS.sphere(0.055, 0xff1744, { emissive: 0xff1744, emissiveIntensity: 1.6 }, 6), 0.15, 0.22, 0.9);
    head.add(led);
    g.userData.head = head;
    g.userData.led = led;
    return g;
  };
  CS.tree = function (rand, scale) {
    rand = rand || Math.random;
    const g = new THREE.Group();
    g.add(CS.at(CS.cyl(0.16, 0.22, 1.4, 0x6d4c41, 6), 0, 0.7, 0));
    const greens = [0x2e7d32, 0x388e3c, 0x43a047];
    g.add(CS.at(CS.cone(1.1, 1.8, greens[Math.floor(rand() * 3)], 7), 0, 2.1, 0));
    g.add(CS.at(CS.cone(0.85, 1.5, greens[Math.floor(rand() * 3)], 7), 0, 3.0, 0));
    g.scale.setScalar(scale || 1);
    return g;
  };
  CS.lamp = function (glow) {
    const g = new THREE.Group();
    g.add(CS.at(CS.cyl(0.07, 0.1, 4.2, 0x455a64, 6), 0, 2.1, 0));
    g.add(CS.at(CS.box(0.9, 0.08, 0.1, 0x455a64), 0.35, 4.2, 0));
    g.add(CS.at(CS.sphere(0.2, 0xfff59d, { emissive: glow ? 0xffee58 : 0x222200, emissiveIntensity: glow ? 1.4 : 0.1 }, 8), 0.75, 4.1, 0));
    return g;
  };
  CS.building = function (w, h, d, color, rand) {
    rand = rand || Math.random;
    const g = new THREE.Group();
    g.add(CS.at(CS.box(w, h, d, color), 0, h / 2, 0));
    g.add(CS.at(CS.box(w + 0.4, 0.4, d + 0.4, 0x78909c), 0, h + 0.2, 0));
    const cols = Math.max(2, Math.floor(w / 2.4));
    const rows = Math.max(2, Math.floor(h / 3));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = rand() > 0.55;
        const win = CS.box(1.0, 1.3, 0.1, lit ? 0xffe082 : 0x37474f, lit ? { emissive: 0xffc107, emissiveIntensity: 0.5 } : {});
        win.castShadow = false;
        win.position.set(-w / 2 + (c + 0.5) * (w / cols), 2 + r * 3, d / 2 + 0.03);
        g.add(win);
      }
    }
    return g;
  };
  CS.car = function (color) {
    const g = new THREE.Group();
    g.add(CS.at(CS.box(3.8, 0.8, 1.7, color), 0, 0.75, 0));
    g.add(CS.at(CS.box(2.0, 0.7, 1.5, color), -0.2, 1.45, 0));
    g.add(CS.at(CS.box(1.7, 0.45, 1.52, 0x90caf9, { emissive: 0x1a3a5a }), -0.2, 1.48, 0));
    [[-1.2, 0.85], [1.2, 0.85], [-1.2, -0.85], [1.2, -0.85]].forEach((p) => {
      const w = CS.cyl(0.4, 0.4, 0.3, 0x212121, 10);
      w.rotation.x = Math.PI / 2;
      w.position.set(p[0], 0.4, p[1]);
      g.add(w);
    });
    return g;
  };

  // ------------------------------------------------------------------- stage
  /** Creates the renderer, scene, camera, lights and the animation loop. */
  CS.createStage = function (container, o) {
    o = Object.assign({ sky: 0xbfe3f5, fogNear: 55, fogFar: 150, hemi: 0.55, sun: 0.72, sunColor: 0xfff2d6, hemiSky: 0xffffff, hemiGround: 0x6b8e5a }, o || {});
    const renderer = new THREE.WebGLRenderer({
      antialias: !CS.LOW,
      preserveDrawingBuffer: o.preserve !== false, // needed to take a photo of the scene
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(CS.LOW ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !CS.LOW;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(o.sky);
    scene.fog = new THREE.Fog(o.sky, o.fogNear, o.fogFar);
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 400);
    const hemi = new THREE.HemisphereLight(o.hemiSky, o.hemiGround, o.hemi);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(o.sunColor, o.sun);
    sun.position.set(22, 34, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -42;
    sc.right = 42;
    sc.top = 42;
    sc.bottom = -42;
    sc.near = 1;
    sc.far = 110;
    sun.shadow.bias = -0.0008;
    scene.add(sun);

    const stage = { renderer, scene, camera, sun, hemi, dom: renderer.domElement, updaters: [], running: true, time: 0 };
    // adaptive quality: if the device is too slow, render at a lower resolution (never goes back up)
    const baseRatio = CS.LOW ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const ratios = [baseRatio, 0.75, 0.55];
    stage.quality = { level: 0, avg: 0.033, frames: 0, started: performance.now() };
    const fpsEl = CS.$('fps');
    stage.resize = function () {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      stage.onResize && stage.onResize(w, h);
    };
    window.addEventListener('resize', stage.resize);
    stage.onFrame = (fn) => stage.updaters.push(fn);

    const clock = new THREE.Clock();
    let acc = 0;
    (function frame() {
      if (!stage.running) return;
      requestAnimationFrame(frame);
      acc += clock.getDelta();
      const q = stage.quality;
      const minInterval = q.level >= 2 ? 0.045 : CS.LOW ? 0.03 : 0; // about 22 / 30 fps caps
      if (acc < minInterval) return;
      const dt = Math.min(acc, 0.05);
      q.avg = q.avg * 0.92 + acc * 0.08; // smoothed real time between frames
      q.frames++;
      acc = 0;
      stage.time = clock.elapsedTime;
      if (q.frames % 45 === 0 && q.level < 2 && q.avg > 0.08 && performance.now() - q.started > 4000) {
        q.level++;
        q.avg = 0.033;
        renderer.setPixelRatio(ratios[q.level]);
        stage.resize();
      }
      if (fpsEl && q.frames % 20 === 0) fpsEl.textContent = (q.level ? 'Q' + q.level + ' · ' : '') + Math.round(1 / q.avg) + ' fps';
      for (let i = 0; i < stage.updaters.length; i++) stage.updaters[i](dt, stage.time);
      renderer.render(scene, camera);
    })();
    stage.resize();
    return stage;
  };

  /** Frees geometries, materials and textures of an object tree (used when the control room redraws). */
  CS.dispose = function (root) {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      ms.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    });
  };

  /** Frame-rate independent smoothing: moves `cur` towards `target`. */
  CS.damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
})();
