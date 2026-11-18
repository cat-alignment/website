/*
  The CAT cat goes for a wander.

  Every so often the cat in the logo gets up and slinks along the ice line
  under the header, between the logo and the "About" link (which it treats as
  a wall). Now and then it stops to loaf, glance round at you, or sit and lick
  its paw. After a while it slinks home and sits back down beside the letters.

  There is never a swap between two cats. While the script runs, the logo cat
  itself is drawn on the canvas (the same paths as assets/cat.svg, tail swish
  and all) and the <img> is hidden. When it sets off, that shape melts into
  the moving cat and the hanging tail swings up; when it comes home, the moving
  cat melts back into exactly the logo cat, on exactly the same ground line.

  The wandering cat is a small 3D rig drawn on a canvas every frame: a spine of
  spheres, rolling shoulder blades, a head with ears and eyes, a jointed tail
  and four two-bone legs. The body, head and legs are drawn together, blurred
  and re-thresholded so they melt into one smooth silhouette, like the vector
  logo cat; ears, tail, whiskers and the ice-blue details go on crisp on top.

  Every pose is a set of numbers and the cat eases between them, so it turns
  round (towards you), lies down and sits up smoothly. Its feet are planted:
  the walk cycle advances with the distance travelled, so they never slide.
  The cat is drawn at one fixed scale, matched to the logo cat, so it never
  changes size.

  Units: "cat units", ground at y = 0, up negative. Nothing runs for people
  who prefer reduced motion. Add #cat-debug to the URL to pose it by hand
  through window.__cat instead of letting it wander.
*/
(() => {
  if (!window.matchMedia || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const header = document.querySelector(".site-header");
  const seat = document.querySelector(".logo__cat img");
  const wall = document.querySelector('.nav a[href="/about/"]') || document.querySelector(".nav");
  if (!header || !seat || !wall) return;

  const style = document.createElement("style");
  style.textContent = `
    .site-header { position: relative; }
    .prowl { position: absolute; left: 0; top: 0; width: 100%; z-index: 2; pointer-events: none; }`;
  document.head.appendChild(style);

  const canvas = document.createElement("canvas");
  canvas.className = "prowl";
  canvas.setAttribute("aria-hidden", "true");
  header.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  // scratch canvas for the smooth silhouette
  const goo = document.createElement("canvas");
  const gctx = goo.getContext("2d", { willReadFrequently: true });

  const FUR = "#0b0b0d";
  const ICE = "#bde3f5";
  const D2R = Math.PI / 180;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const smooth = (u) => u * u * (3 - 2 * u);

  // ------------------------------------------------------------------ the logo cat
  // Copied from assets/cat.svg: viewBox 0 0 44 100, ledge at y = 62, drawn
  // mirrored. Keep the two in step.
  const LOGO = {
    body: new Path2D("M13 62C8 62 5.5 57.5 6 52C6.6 44 10.5 37 14.5 30.5C15.8 28.4 16.6 26.4 16.9 24.6C15 22.4 14.2 18.8 14.8 15.4C15 14 15.4 12.8 15.9 11.8L15.6 2.6L21.8 7.2C23.2 6.8 25 6.8 26.4 7.2L31.6 2.4L32.4 10.8C33.4 12.6 33.9 14.8 33.6 16.8C33.3 19.6 31.8 22 29.4 23.6C31.6 27 33.6 32 34.6 38C35.6 44.5 36 50 35.8 55C35.8 59.5 34 62 31 62Z"),
    whisk: new Path2D("M33.4 16.6L38.6 15.4M33.2 18.6L38.2 19.6"),
    ice: new Path2D("M29.2 8.8L30.9 5.6L31.3 9.8M28 61C28.4 55 25 50.5 20 50.5"),
  };
  // The tail swish: M13 57C11.5 64 a 71 b 78S c d e f, as [a, b, c, d, e, f].
  const SWISH_T = [0, 0.52, 0.59, 0.67, 0.75, 0.83, 0.93, 1];
  const SWISH = [
    [10.8, 11.6, 14, 89, 12, 95], [10.8, 11.6, 14, 89, 12, 95], [11.3, 12.5, 10, 90, 5.5, 92.5],
    [10.3, 10.7, 14, 90, 19.5, 93], [11.1, 12.1, 11.5, 90, 8, 94.5], [10.6, 11.2, 14.3, 89.5, 15.6, 95],
    [10.8, 11.6, 14, 89, 12, 95], [10.8, 11.6, 14, 89, 12, 95],
  ];
  const bez1 = (t, a, b) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
  function ease4555(u) { // cubic-bezier(.45, 0, .55, 1), as in the SVG's keySplines
    let lo = 0, hi = 1;
    for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (bez1(m, 0.45, 0.55) < u) lo = m; else hi = m; }
    return bez1((lo + hi) / 2, 0, 1);
  }
  // The SVG animation's clock starts when the image loads.
  let logoT0 = performance.now();
  try {
    const e = performance.getEntriesByName(seat.currentSrc || seat.src)[0];
    if (e && e.responseEnd) logoT0 = e.responseEnd;
  } catch (_) { /* keep the estimate */ }
  if (!seat.complete) seat.addEventListener("load", () => { logoT0 = performance.now(); }, { once: true });
  const swishTime = () => (((performance.now() - logoT0) / 1000) % 7 + 7) % 7;
  // The tail's seven control points (svg units) at the current moment.
  function logoTail() {
    const u = swishTime() / 7;
    let i = 0;
    while (i < SWISH_T.length - 2 && u >= SWISH_T[i + 1]) i++;
    let f = clamp((u - SWISH_T[i]) / (SWISH_T[i + 1] - SWISH_T[i]), 0, 1);
    if (i >= 1 && i <= 5) f = ease4555(f);
    const v = SWISH[i].map((a, j) => lerp(a, SWISH[i + 1][j], f));
    return [[13, 57], [11.5, 64], [v[0], 71], [v[1], 78], [2 * v[1] - v[0], 85], [v[2], v[3]], [v[4], v[5]]];
  }
  const cub = (a, b, c, d, t) => {
    const u = 1 - t;
    return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
            u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]];
  };

  // ------------------------------------------------------------------ poses
  const STAND = {
    hipX: -18, hipY: -27.5, shX: 17, shY: -28, arch: 0.8, fat: 0.95,
    headX: 7.5, headY: -11, tilt: -4, look: 0, haunch: 0,
    tailA: 236, tailC: 8, tailFloor: 0, eye: 1, raise: 0, lick: 0,
    fFoot: 1, hFoot: -1,
  };
  const POSES = {
    stand: STAND,
    // the slink: a little lower and longer, head forward, tail up in a soft curve
    walk: {
      ...STAND, hipY: -26.5, shY: -26, arch: -0.6, headX: 9, headY: -9.5, tilt: 2,
      tailA: 226, tailC: 7.5,
    },
    look: { ...STAND, look: 58, headY: -11.5, tilt: -4 },
    sniff: { ...STAND, shY: -24.5, headX: 10, headY: -1, tilt: 30, tailA: 232, tailC: 6 },
    loaf: {
      ...STAND, hipX: -15, hipY: -8.5, shX: 12, shY: -8.8, arch: -0.4, fat: 1.12,
      headX: 5.5, headY: -8, tilt: -4, tailA: 150, tailC: -11, tailFloor: 1, eye: 0,
      fFoot: 6, hFoot: 4,
    },
    sit: {
      ...STAND, hipX: -9, hipY: -9, shX: 3, shY: -30, arch: -1, fat: 1.2,
      headX: 2, headY: -9.5, tilt: -4, haunch: 1, tailA: 140, tailC: -10, tailFloor: 1,
      fFoot: 2, hFoot: 9,
    },
  };
  POSES.groom = { ...POSES.sit, headX: 4.5, headY: -4.5, tilt: 30, eye: 0, raise: 1, lick: 1 };

  // ------------------------------------------------------------------ state
  const P = { ...STAND };
  let T = STAND;
  const s = {
    x: 0, gy: 0,
    yaw: 25, yawT: 25,
    v: 0, phase: 0, amp: 0,
    t: 0, goal: null, onGoal: null,
    blinkAt: 2, blinkT: 0,
    m: 0, mT: 0, // 0 = the logo cat, 1 = the moving cat
  };
  const MORPH = 0.9; // seconds to melt from one into the other
  const SEAT_YAW = -105; // back to us, head turned left, like the logo cat
  const setPose = (name, snap) => { T = POSES[name]; if (snap) Object.assign(P, T); };

  const V = 30;      // slinking speed, units/s
  const STRIDE = 28; // body travel per gait cycle, units
  const DUTY = 0.68; // share of the cycle each paw is on the ground
  const ACC = 30;    // units/s^2: eases in and out of a walk
  const VIEW = 25;   // the cat is always seen a little from the front
  const HS = 0.95;   // head scale
  const HOME_DX = 0; // lines the sitting moving cat up over the logo cat
  const SS = 2;      // supersampling of the smooth silhouette

  // ------------------------------------------------------------------ geometry
  // k: css px per cat unit. L: where the logo cat sits on the canvas.
  let k = 0.5, W = 0, H = 0, dpr = 1, ground = 0, geo = null;
  const L = { x: 0, y: 0, q: 0.4 };
  function measure() {
    const h = header.getBoundingClientRect();
    const st = seat.getBoundingClientRect();
    const wl = wall.getBoundingClientRect();
    // One fixed scale, matched to the logo cat: 100 svg units = 84 cat units.
    k = st.height / 84 || 0.5;
    L.q = st.height / 100 || 0.4;
    // The ground is the logo cat's own ledge (svg y = 62), so the moving cat
    // stands exactly where the logo cat sits.
    const ledge = st.top - h.top + 62 * L.q;
    const top = Math.floor(ledge - 66 * k);
    W = header.clientWidth;
    H = Math.ceil(ledge + 40 * k - top);
    ground = ledge - top;
    dpr = Math.min(3, window.devicePixelRatio || 1);
    // the browser paints the <img> snapped down to whole device pixels; do the same
    L.x = Math.floor(st.left * dpr + 1e-3) / dpr - h.left;
    L.y = Math.floor(st.top * dpr + 1e-3) / dpr - h.top - top;
    canvas.style.top = top + "px";
    canvas.style.height = H + "px";
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const reach = 36 * k;
    const home = L.x + 23 * L.q + HOME_DX * k;
    geo = {
      home,
      min: home,
      max: wl.left - h.left - 6 - reach, // the nose stops just short of "About"
      reach,
    };
    if (s.goal !== null) s.goal = clamp(s.goal, geo.min, Math.max(geo.min, geo.max));
  }
  measure();
  window.addEventListener("resize", measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  // ------------------------------------------------------------------ simulation
  function nearestAngle(a, from) {
    while (a - from > 180) a -= 360;
    while (a - from < -180) a += 360;
    return a;
  }

  function update(dt) {
    s.t += dt;
    const pr = 1 - Math.exp(-dt * 3.2);
    for (const key in T) P[key] += (T[key] - P[key]) * pr;

    // turning: unhurried, through facing us
    const yr = 1 - Math.exp(-dt * 2.4);
    const yawVel = (s.yawT - s.yaw) * 2.4;
    s.yaw += (s.yawT - s.yaw) * yr;
    const c = Math.cos(s.yaw * D2R);

    // slinking: a gentle wander in pace, easing in and out
    let tv = 0;
    if (s.goal !== null) {
      const dist = s.goal - s.x;
      const want = Math.sign(dist);
      if (Math.abs(dist) < 0.6 && s.v < 3) {
        s.goal = null; s.v = 0;
        const f = s.onGoal; s.onGoal = null; f && f();
      } else if (want) {
        s.yawT = nearestAngle(want > 0 ? VIEW : 180 - VIEW, s.yaw);
        if (c * want > 0.8) {
          const pace = V * (1 + 0.12 * Math.sin(s.t * 0.7) + 0.06 * Math.sin(s.t * 1.9));
          tv = Math.min(pace, Math.sqrt(2 * ACC * 0.7 * Math.abs(dist) / k));
        }
      }
    }
    s.v += clamp(tv - s.v, -ACC * dt, ACC * dt);
    const step = Math.sign(c) * s.v * k * dt;
    if (s.goal !== null && Math.sign(s.goal - s.x) !== Math.sign(s.goal - s.x - step)) s.x = s.goal;
    else s.x += step;
    const turning = Math.abs(yawVel) > 20;
    s.phase = (s.phase + s.v * dt / STRIDE + (turning ? dt * 1.1 : 0)) % 1;
    const ampT = Math.max(Math.min(1, s.v / (V * 0.5)), turning ? 0.4 : 0);
    s.amp += (ampT - s.amp) * (1 - Math.exp(-dt * 4));

    s.m += clamp(s.mT - s.m, -dt / MORPH, dt / MORPH);

    if (s.t > s.blinkAt) { s.blinkT = 0.16; s.blinkAt = s.t + rand(2.5, 6); }
    s.blinkT = Math.max(0, s.blinkT - dt);
  }

  // Foot offset along the body, lift, and stance progress (or -1 in swing).
  function gait(p) {
    p = ((p % 1) + 1) % 1;
    if (p < DUTY) return [STRIDE * DUTY * (0.5 - p / DUTY), 0, p / DUTY];
    const u = (p - DUTY) / (1 - DUTY);
    const e = u * u * (3 - 2 * u);
    return [STRIDE * DUTY * (-0.5 + e), 2.4 * Math.sin(Math.PI * u), -1];
  }

  function ik(jx, jy, fx, fy, a, b) {
    const dx = fx - jx, dy = fy - jy;
    const d = Math.hypot(dx, dy) || 0.001;
    const dc = clamp(d, Math.abs(a - b) + 0.1, a + b - 0.05);
    const base = Math.atan2(dy, dx);
    const al = Math.acos(clamp((a * a + dc * dc - b * b) / (2 * a * dc), -1, 1));
    let kx = jx + a * Math.cos(base + al), ky = jy + a * Math.sin(base + al);
    // a folded leg (sitting, loafing) never pushes its knee through the floor
    const ky2 = jy + a * Math.sin(base - al);
    if (ky > -2 && ky2 < ky) { kx = jx + a * Math.cos(base - al); ky = ky2; }
    return [kx, ky, jx + dx / d * dc, jy + dy / d * dc];
  }

  // ------------------------------------------------------------------ drawing
  const RADII = [[0, 6.2], [0.12, 7.4], [0.3, 6.6], [0.55, 5.3], [0.78, 6.6], [0.92, 7.5], [1, 6.2]];
  function bodyR(t) {
    for (let i = 1; i < RADII.length; i++) {
      if (t <= RADII[i][0]) {
        const [t0, r0] = RADII[i - 1], [t1, r1] = RADII[i];
        return lerp(r0, r1, (t - t0) / (t1 - t0));
      }
    }
    return RADII[RADII.length - 1][1];
  }

  // Separable box blur of an alpha channel, in place.
  function blurAlpha(a, w, h, r, tmp) {
    for (let y = 0; y < h; y++) {
      const o = y * w;
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += a[o + clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        tmp[o + x] = sum / (2 * r + 1);
        sum += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += tmp[clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = sum / (2 * r + 1);
        sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
  }
  let alphaBuf = new Float32Array(0), tmpBuf = new Float32Array(0), logoBuf = new Float32Array(0);

  // Paint the logo cat (body, whiskers, ice lines and, if given, its tail)
  // onto c2d, where sx is device px per css px and (ox, oy) the css origin.
  function paintLogo(c2d, sx, ox, oy, alpha, tail, silhouetteOnly) {
    c2d.save();
    c2d.globalAlpha = alpha;
    c2d.setTransform(-L.q * sx, 0, 0, L.q * sx, (L.x + 44 * L.q - ox) * sx, (L.y - oy) * sx);
    c2d.lineJoin = "round"; c2d.lineCap = "round";
    c2d.fillStyle = FUR; c2d.strokeStyle = FUR;
    c2d.lineWidth = 1;
    c2d.fill(LOGO.body); c2d.stroke(LOGO.body);
    if (!silhouetteOnly) {
      c2d.lineWidth = 0.8; c2d.stroke(LOGO.whisk);
      c2d.strokeStyle = ICE; c2d.lineWidth = 1.4; c2d.stroke(LOGO.ice);
      if (tail) {
        c2d.strokeStyle = FUR; c2d.lineWidth = 3.4;
        c2d.beginPath(); c2d.moveTo(tail[0][0], tail[0][1]);
        c2d.bezierCurveTo(tail[1][0], tail[1][1], tail[2][0], tail[2][1], tail[3][0], tail[3][1]);
        c2d.bezierCurveTo(tail[4][0], tail[4][1], tail[5][0], tail[5][1], tail[6][0], tail[6][1]);
        c2d.stroke();
      }
    }
    c2d.restore();
  }
  const logoPt = (p) => [L.x + (44 - p[0]) * L.q, L.y + p[1] * L.q];

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const m = smooth(clamp(s.m, 0, 1));
    const lt = logoTail();
    if (m < 0.001) { paintLogo(ctx, dpr, 0, 0, 1, lt); return; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const th = s.yaw * D2R, c = Math.cos(th), sn = Math.sin(th);
    const baseY = ground + s.gy;
    const pr = (x, y, z) => [s.x + (x * c - z * sn) * k, baseY + y * k, x * sn + z * c];
    const blobs = [];   // smooth silhouette: circles and capsules
    const crisp = [];   // drawn sharp on top
    const W_SIDE = 4.2;
    const nearSide = c >= 0 ? 1 : -1;

    const amp = s.amp;
    // the body glides: only a whisper of bob, and the spine sways with the stride
    const bob = amp * 0.35 * Math.sin(s.phase * Math.PI * 4);
    const breathe = 1 + (1 - Math.min(1, amp * 2)) * 0.022 * Math.sin(s.t * 1.7);
    const hipY = P.hipY + bob, shY = P.shY + bob * 0.5;
    const arch = P.arch + amp * 0.6 * Math.sin(s.phase * Math.PI * 2);

    const R = [P.hipX - 5, hipY + 0.5], C = [P.shX + 4.5, shY + 2];
    const M = [(R[0] + C[0]) / 2, (R[1] + C[1]) / 2 - arch];
    const N = 22;
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = 1 - t;
      const x = u * u * R[0] + 2 * u * t * M[0] + t * t * C[0];
      const y = u * u * R[1] + 2 * u * t * M[1] + t * t * C[1];
      const r = bodyR(t) * P.fat * breathe;
      const [X, Y] = pr(x, y, 0);
      blobs.push([X, Y, r * k]);
    }
    if (P.haunch > 0.02) {
      for (const side of [1, -1]) {
        const [X, Y] = pr(P.hipX + 3, hipY - 1.5, side * 3);
        blobs.push([X, Y, 10.5 * P.haunch * k]);
      }
    }

    // head: held level and steady while slinking
    const lickNow = Math.max(0, Math.sin(s.t * 10));
    const hx = P.shX + P.headX, hy = shY + P.headY - bob * 0.4 + P.lick * 1.6 * lickNow;
    const tilt = (P.tilt + P.lick * 6 * lickNow) * D2R;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const look = P.look * nearSide * D2R + Math.sin(s.t * 0.9) * 0.05 * amp;
    const cl = Math.cos(look), sl = Math.sin(look);
    const hp = (x, y, z) => {
      x *= HS; y *= HS; z *= HS;
      const x1 = x * ct - y * st, y1 = x * st + y * ct;
      return pr(hx + x1 * cl - z * sl, hy + y1, x1 * sl + z * cl);
    };
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      const [X, Y] = pr(lerp(P.shX + 1, hx - 1.5, t), lerp(shY - 2, hy + 1, t), 0);
      blobs.push([X, Y, lerp(5.2, 4.4, t) * k]);
    }
    const H0 = hp(0, 0, 0);
    blobs.push([H0[0], H0[1], 7.4 * HS * k]);
    const MZ = hp(5.4, 2.4, 0);
    blobs.push([MZ[0], MZ[1], 3.5 * HS * k]);
    for (const side of [1, -1]) {
      const ear = [hp(-3.6, -4.6, side * 2), hp(1.4, -5.4, side * 5.8), hp(-1.6, -12, side * 5)];
      crisp.push({ poly: ear });
      blobs.push({ poly: ear });
      const E = hp(4.3, -1.4, side * 3.4);
      const nz = (E[2] - H0[2]) / (5.7 * HS);
      if (nz > 0.12) crisp.push({ eye: [E[0], E[1], P.eye * (s.blinkT > 0 ? 0.1 : 1), clamp((nz - 0.12) * 5, 0, 1)] });
      crisp.push({ whisk: [hp(7.6, 2.8, side * 1.6), hp(13, 1.6, side * 5), hp(12.6, 4.6, side * 5)] });
    }

    // legs, with shoulder blades that roll up as each front paw takes the weight
    const muzzle = [hx + (5.4 * ct - 2.4 * st) * HS, hy + (5.4 * st + 2.4 * ct) * HS];
    const legs = [
      { front: false, side: 1, off: 0 }, { front: true, side: 1, off: 0.25 },
      { front: false, side: -1, off: 0.5 }, { front: true, side: -1, off: 0.75 },
    ];
    let raisedLeg = null;
    for (const L of legs) {
      const jx = L.front ? P.shX : P.hipX + 1;
      const jy = (L.front ? shY : hipY) + (L.front ? 4 : 3.5);
      const [go, lift, stance] = gait(s.phase + L.off);
      let fx = (L.front ? P.shX + P.fFoot : P.hipX + P.hFoot) + go * amp;
      let fy = -2.1 - lift * amp;
      const raised = L.front && L.side === nearSide && P.raise > 0.01;
      if (raised) {
        const lb = P.lick * 0.8 * Math.sin(s.t * 10);
        fx = lerp(fx, muzzle[0] + 3.4, P.raise);
        fy = lerp(fy, muzzle[1] + 2.6 + lb, P.raise);
      }
      const a = L.front ? 10.6 : 11.6;
      const [kx, ky, px, py] = ik(jx, jy, fx, fy, a, a);
      const z = L.side * W_SIDE;
      const J = pr(jx, jy, z), K = pr(kx, ky, z), F = pr(px, py, z);
      blobs.push([J, K, (L.front ? 4 : 5.6) * k]);
      blobs.push([K, F, 3 * k]);
      blobs.push([F[0], F[1], 2.2 * k]);
      if (raised) raisedLeg = [J, K, F];
      // blade / hip bump on the back
      const lift2 = stance >= 0 ? Math.sin(Math.PI * stance) : 0;
      if (L.front) {
        const B = pr(P.shX - 2.5, shY - 1.5 - lift2 * amp * 1.4, z * 0.4);
        blobs.push([B[0], B[1], 4.2 * k]);
      }
    }

    // tail: low and trailing, with a slow wave running down it
    const tail = [];
    {
      let x = P.hipX - 5.5, y = hipY - 2.5, z = 0, a = P.tailA;
      const sway = 1 - P.tailFloor;
      tail.push(pr(x, y, z));
      for (let i = 1; i <= 12; i++) {
        a += P.tailC + Math.sin(s.t * 1.6 - i * 0.5) * (1.5 + sway * 2.2 * (0.5 + amp));
        x += 2.7 * Math.cos(a * D2R);
        y = Math.min(y + 2.7 * Math.sin(a * D2R), -1.7);
        z = P.tailFloor * W_SIDE * 2.8 * (i / 12) + sway * Math.sin(s.t * 1.9 - i * 0.4) * i * 0.28;
        tail.push(pr(x, y, z));
      }
    }

    // ---- smooth silhouette: draw blobs, blur, threshold. While melting, the
    // field is a mix of the logo cat's and the moving cat's, so one shape
    // flows into the other instead of cross-fading.
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const grow = (x, y, r) => { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); };
    for (const b of blobs) {
      if (b.poly) for (const p of b.poly) grow(p[0], p[1], 0);
      else if (Array.isArray(b[0])) { grow(b[0][0], b[0][1], b[2]); grow(b[1][0], b[1][1], b[2]); }
      else grow(b[0], b[1], b[2]);
    }
    if (m < 1) { const a = logoPt([37, 1.5]), b = logoPt([5, 63]); grow(a[0], a[1], 0); grow(b[0], b[1], 0); }
    const G = dpr * SS;
    const pad = 4;
    const gx = Math.floor(x0 - pad), gy = Math.floor(y0 - pad);
    const gw = Math.ceil((x1 - gx + pad) * G), gh = Math.ceil((y1 - gy + pad) * G);
    if (goo.width < gw || goo.height < gh) { goo.width = Math.max(goo.width, gw); goo.height = Math.max(goo.height, gh); }
    const n = gw * gh;
    if (alphaBuf.length < n) { alphaBuf = new Float32Array(n); tmpBuf = new Float32Array(n); logoBuf = new Float32Array(n); }
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    if (m < 1) {
      gctx.clearRect(0, 0, goo.width, goo.height);
      paintLogo(gctx, G, gx, gy, 1, null, true);
      const d0 = gctx.getImageData(0, 0, gw, gh).data;
      for (let i = 0; i < n; i++) logoBuf[i] = d0[i * 4 + 3];
    }
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.clearRect(0, 0, goo.width, goo.height);
    gctx.setTransform(G, 0, 0, G, -gx * G, -gy * G);
    gctx.fillStyle = "#000"; gctx.strokeStyle = "#000"; gctx.lineCap = "round"; gctx.lineJoin = "round";
    for (const b of blobs) {
      if (b.poly) {
        gctx.lineWidth = 0.9 * k;
        gctx.beginPath(); b.poly.forEach((p, i) => (i ? gctx.lineTo(p[0], p[1]) : gctx.moveTo(p[0], p[1])));
        gctx.closePath(); gctx.fill(); gctx.stroke();
      } else if (Array.isArray(b[0])) {
        gctx.lineWidth = b[2];
        gctx.beginPath(); gctx.moveTo(b[0][0], b[0][1]); gctx.lineTo(b[1][0], b[1][1]); gctx.stroke();
      } else {
        gctx.beginPath(); gctx.arc(b[0], b[1], b[2], 0, Math.PI * 2); gctx.fill();
      }
    }
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    const img = gctx.getImageData(0, 0, gw, gh);
    const d = img.data;
    if (m < 1) for (let i = 0; i < n; i++) alphaBuf[i] = d[i * 4 + 3] * m + logoBuf[i] * (1 - m);
    else for (let i = 0; i < n; i++) alphaBuf[i] = d[i * 4 + 3];
    const r = Math.max(1, Math.round(1.76 * k * G * lerp(0.5, 1, m)));
    blurAlpha(alphaBuf, gw, gh, r, tmpBuf);
    blurAlpha(alphaBuf, gw, gh, Math.max(1, r >> 1), tmpBuf);
    const gain = Math.max(3, r * 2.2); // a hard edge; the downscale below antialiases it
    for (let i = 0; i < n; i++) {
      const a = clamp((alphaBuf[i] - 128) * gain + 128, 0, 255);
      d[i * 4] = 11; d[i * 4 + 1] = 11; d[i * 4 + 2] = 13; d[i * 4 + 3] = a;
    }
    gctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(goo, 0, 0, gw, gh, gx, gy, gw / G, gh / G);

    // the logo cat's own crisp lines fade as it starts to move
    const la = clamp(1 - m / 0.35, 0, 1);
    if (la > 0) paintLogo(ctx, dpr, 0, 0, la, null);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ra = clamp((m - 0.35) / 0.65, 0, 1); // the moving cat's details fade in

    // ---- crisp details
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = FUR; ctx.fillStyle = FUR;
    // tail as one smooth tapering curve; while melting it swings between the
    // logo cat's hanging tail and the moving cat's
    if (m < 1) {
      const lp = [];
      for (let i = 0; i <= 6; i++) lp.push(cub(lt[0], lt[1], lt[2], lt[3], i / 6));
      for (let i = 1; i <= 6; i++) lp.push(cub(lt[3], lt[4], lt[5], lt[6], i / 6));
      for (let i = 0; i < tail.length; i++) {
        const p = logoPt(lp[i]);
        tail[i] = [lerp(p[0], tail[i][0], m), lerp(p[1], tail[i][1], m)];
      }
    }
    for (const [w, end] of [[4.2, 6], [3.3, tail.length - 1]]) {
      ctx.lineWidth = lerp(3.4 * L.q, w * k, m);
      ctx.beginPath();
      ctx.moveTo(tail[0][0], tail[0][1]);
      for (let i = 1; i < end; i++) {
        const mx = (tail[i][0] + tail[i + 1][0]) / 2, my = (tail[i][1] + tail[i + 1][1]) / 2;
        ctx.quadraticCurveTo(tail[i][0], tail[i][1], mx, my);
      }
      ctx.lineTo(tail[end][0], tail[end][1]);
      ctx.stroke();
    }
    ctx.globalAlpha = ra;
    for (const it of crisp) {
      if (it.poly) {
        ctx.beginPath();
        it.poly.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.closePath(); ctx.fill();
        ctx.lineWidth = 0.9 * k; ctx.stroke();
      } else if (it.whisk) {
        const [o, a, b] = it.whisk;
        ctx.lineWidth = 0.4 * k + 0.25;
        ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(a[0], a[1]);
        ctx.moveTo(o[0], o[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // ice-blue details, like the logo cat's
    if (raisedLeg && P.raise > 0.05) {
      const [J, K, F] = raisedLeg;
      ctx.globalAlpha = P.raise * ra;
      // outline the forearm only, so it reads against the chest
      ctx.strokeStyle = ICE; ctx.lineWidth = 5.4 * k;
      ctx.beginPath(); ctx.moveTo(lerp(K[0], F[0], 0.2), lerp(K[1], F[1], 0.2)); ctx.lineTo(F[0], F[1]); ctx.stroke();
      ctx.strokeStyle = FUR; ctx.lineWidth = 3.6 * k;
      ctx.beginPath(); ctx.moveTo(K[0], K[1]); ctx.lineTo(F[0], F[1]); ctx.stroke();
      ctx.beginPath(); ctx.arc(F[0], F[1], 2.3 * k, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    {
      const alpha = clamp(Math.abs(c) * 1.6 - 0.4, 0, 1) * (1 - P.haunch) * ra;
      if (alpha > 0.02) {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = ICE; ctx.lineWidth = 1.3 * k;
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) {
          const ang = lerp(40, -95, i / 10) * D2R;
          const p = pr(P.hipX + 1.5 + 6.2 * Math.cos(ang), hipY + 2.5 + 6.2 * Math.sin(ang), nearSide * 8);
          i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    for (const it of crisp) {
      if (!it.eye) continue;
      const [X, Y, open, alpha] = it.eye;
      ctx.globalAlpha = alpha * ra;
      if (open > 0.4) {
        ctx.fillStyle = ICE;
        ctx.beginPath(); ctx.ellipse(X, Y, 1.4 * k, 1.15 * k * open, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = ICE; ctx.lineWidth = 0.8 * k;
        ctx.beginPath(); ctx.moveTo(X - 1.5 * k, Y); ctx.quadraticCurveTo(X, Y + 1.2 * k, X + 1.5 * k, Y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------------ loop
  // The canvas draws the logo cat all the time, so the moving cat can grow
  // straight out of it. If anything goes wrong the <img> comes back.
  let running = false, last = 0;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    try {
      update(dt);
      draw();
      seat.style.visibility = "hidden";
    } catch (err) {
      running = false;
      seat.style.visibility = "";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      throw err;
    }
    requestAnimationFrame(frame);
  }
  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ behaviour
  const walkTo = (x) => new Promise((done) => {
    setPose("walk");
    s.goal = clamp(x, geo.min, Math.max(geo.min, geo.max));
    s.onGoal = () => { setPose("stand"); done(); };
  });
  const face = (deg) => { s.yawT = nearestAngle(deg, s.yaw); };
  const melt = (to) => { s.mT = to; return sleep(MORPH * 1000 + 150); };

  async function outing() {
    measure();
    if (geo.max - geo.min < geo.reach * 4) return; // not enough room on small screens

    // The logo cat comes to life where it sits.
    s.x = geo.home; s.gy = 0; s.yaw = s.yawT = SEAT_YAW; s.v = 0; s.amp = 0; s.goal = null;
    setPose("sit", true);
    await melt(1);
    await sleep(300);
    setPose("stand");
    face(VIEW);
    await sleep(1400);

    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      measure();
      if (Math.random() < 0.3) {
        await walkTo(geo.max); // up to the wall for a sniff
        setPose("sniff"); await sleep(rand(1600, 2600));
        setPose("stand"); await sleep(600);
        continue;
      }
      const span = geo.max - geo.min;
      let tx, tries = 0;
      do { tx = geo.min + Math.random() * span; } while (Math.abs(tx - s.x) < span * 0.25 && ++tries < 20);
      await walkTo(tx);
      const r = Math.random();
      if (r < 0.3) {
        setPose("loaf"); await sleep(rand(7000, 13000));
      } else if (r < 0.6) {
        setPose("sit"); await sleep(1100);
        setPose("groom"); await sleep(rand(3500, 6500));
        setPose("sit"); await sleep(rand(900, 1600));
      } else {
        setPose("look"); await sleep(rand(1400, 2600));
      }
      setPose("stand");
      await sleep(800);
    }

    // Home: slink back, turn our back to us, sit, and become the logo cat again.
    measure();
    await walkTo(geo.home);
    face(SEAT_YAW);
    await sleep(1200);
    setPose("sit");
    await sleep(1100);
    await melt(0);
  }

  if (location.hash === "#cat-debug") {
    window.__cat = { s, P, setPose, measure, start, draw, update, geo: () => geo, canvas, seat, L, logoTail };
    return;
  }

  start();
  (async () => {
    await sleep(rand(2500, 4000));
    for (;;) {
      await outing();
      await sleep(rand(12000, 25000));
    }
  })();
})();
