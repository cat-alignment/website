/*
  The CAT cat goes for a wander.

  Every so often the cat in the logo hops down onto the ice line under the
  header and slinks along it, between the logo and the "About" link (which it
  treats as a wall). Now and then it stops to loaf, glance round at you, or sit
  and lick its paw. After a while it slinks home and hops back up beside the
  letters.

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
    .prowl { position: absolute; left: 0; bottom: 2px; width: 100%; z-index: 2;
             pointer-events: none; opacity: 0; transition: opacity .35s ease; }
    .prowl.is-out { opacity: 1; }
    .logo__cat img { transition: opacity .35s ease; }`;
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
      ...STAND, hipX: -9, hipY: -9, shX: 3, shY: -30, arch: -1, fat: 1,
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
    jump: null, blinkAt: 2, blinkT: 0,
  };
  const setPose = (name, snap) => { T = POSES[name]; if (snap) Object.assign(P, T); };

  const V = 30;      // slinking speed, units/s
  const STRIDE = 28; // body travel per gait cycle, units
  const DUTY = 0.68; // share of the cycle each paw is on the ground
  const ACC = 30;    // units/s^2: eases in and out of a walk
  const VIEW = 25;   // the cat is always seen a little from the front
  const HS = 0.95;   // head scale

  // ------------------------------------------------------------------ geometry
  let k = 0.5, W = 0, H = 0, dpr = 1, geo = null;
  function measure() {
    // One fixed scale, matched to the logo cat (its head and body widths).
    k = seat.getBoundingClientRect().height / 84 || 0.5;
    W = header.clientWidth;
    H = Math.ceil(84 * k);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.height = H + "px";
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const h = header.getBoundingClientRect();
    const st = seat.getBoundingClientRect();
    const wl = wall.getBoundingClientRect();
    const reach = 36 * k;
    const home = st.left + st.width / 2 - h.left;
    geo = {
      home,
      min: home,
      max: wl.left - h.left - 6 - reach, // the nose stops just short of "About"
      seatDy: st.top + st.height * 0.62 - (h.bottom - 2),
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

    if (s.jump) {
      const j = s.jump;
      j.t += dt;
      const u = clamp(j.t / j.dur, 0, 1);
      const e = u * u * (3 - 2 * u);
      s.gy = lerp(j.from, j.to, e) - Math.sin(Math.PI * u) * 9 * k;
      if (u >= 1) { s.jump = null; j.done(); }
    }

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
    return [jx + a * Math.cos(base + al), jy + a * Math.sin(base + al), jx + dx / d * dc, jy + dy / d * dc];
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
  let alphaBuf = new Float32Array(0), tmpBuf = new Float32Array(0);

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const th = s.yaw * D2R, c = Math.cos(th), sn = Math.sin(th);
    const baseY = H - 1 + s.gy;
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
        blobs.push([X, Y, 9 * P.haunch * k]);
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
      crisp.push({ poly: [hp(-3.6, -4.6, side * 1.3), hp(1.4, -5.4, side * 4.8), hp(-1.6, -12, side * 4)] });
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
      if (s.jump) fy -= Math.sin(Math.PI * clamp(s.jump.t / s.jump.dur, 0, 1)) * 3;
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
        z = P.tailFloor * W_SIDE * 1.7 * (i / 12) + sway * Math.sin(s.t * 1.9 - i * 0.4) * i * 0.28;
        tail.push(pr(x, y, z));
      }
    }

    // ---- smooth silhouette: draw blobs, blur, threshold
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const grow = (x, y, r) => { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); };
    for (const b of blobs) {
      if (Array.isArray(b[0])) { grow(b[0][0], b[0][1], b[2]); grow(b[1][0], b[1][1], b[2]); }
      else grow(b[0], b[1], b[2]);
    }
    const pad = 4;
    const gx = Math.floor(x0 - pad), gy = Math.floor(y0 - pad);
    const gw = Math.ceil((x1 - x0 + 2 * pad) * dpr), gh = Math.ceil((y1 - y0 + 2 * pad) * dpr);
    if (goo.width < gw || goo.height < gh) { goo.width = Math.max(goo.width, gw); goo.height = Math.max(goo.height, gh); }
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.clearRect(0, 0, goo.width, goo.height);
    gctx.setTransform(dpr, 0, 0, dpr, -gx * dpr, -gy * dpr);
    gctx.fillStyle = "#000"; gctx.strokeStyle = "#000"; gctx.lineCap = "round";
    for (const b of blobs) {
      if (Array.isArray(b[0])) {
        gctx.lineWidth = b[2];
        gctx.beginPath(); gctx.moveTo(b[0][0], b[0][1]); gctx.lineTo(b[1][0], b[1][1]); gctx.stroke();
      } else {
        gctx.beginPath(); gctx.arc(b[0], b[1], b[2], 0, Math.PI * 2); gctx.fill();
      }
    }
    const img = gctx.getImageData(0, 0, gw, gh);
    const d = img.data, n = gw * gh;
    if (alphaBuf.length < n) { alphaBuf = new Float32Array(n); tmpBuf = new Float32Array(n); }
    for (let i = 0; i < n; i++) alphaBuf[i] = d[i * 4 + 3];
    const r = Math.max(1, Math.round(1.1 * k * dpr * 1.6));
    blurAlpha(alphaBuf, gw, gh, r, tmpBuf);
    blurAlpha(alphaBuf, gw, gh, Math.max(1, r >> 1), tmpBuf);
    const gain = Math.max(2.5, r * 1.9); // edge about one device pixel wide
    for (let i = 0; i < n; i++) {
      const a = clamp((alphaBuf[i] - 128) * gain + 128, 0, 255);
      d[i * 4] = 11; d[i * 4 + 1] = 11; d[i * 4 + 2] = 13; d[i * 4 + 3] = a;
    }
    gctx.putImageData(img, 0, 0);
    ctx.drawImage(goo, 0, 0, gw, gh, gx, gy, gw / dpr, gh / dpr);

    // ---- crisp details
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = FUR; ctx.fillStyle = FUR;
    // tail as one smooth tapering curve
    for (const [w, end] of [[4.2, 6], [3.3, tail.length - 1]]) {
      ctx.lineWidth = w * k;
      ctx.beginPath();
      ctx.moveTo(tail[0][0], tail[0][1]);
      for (let i = 1; i < end; i++) {
        const mx = (tail[i][0] + tail[i + 1][0]) / 2, my = (tail[i][1] + tail[i + 1][1]) / 2;
        ctx.quadraticCurveTo(tail[i][0], tail[i][1], mx, my);
      }
      ctx.lineTo(tail[end][0], tail[end][1]);
      ctx.stroke();
    }
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
    // ice-blue details, like the logo cat's
    if (raisedLeg && P.raise > 0.05) {
      const [J, K, F] = raisedLeg;
      ctx.globalAlpha = P.raise;
      // outline the forearm only, so it reads against the chest
      ctx.strokeStyle = ICE; ctx.lineWidth = 5.4 * k;
      ctx.beginPath(); ctx.moveTo(lerp(K[0], F[0], 0.2), lerp(K[1], F[1], 0.2)); ctx.lineTo(F[0], F[1]); ctx.stroke();
      ctx.strokeStyle = FUR; ctx.lineWidth = 3.6 * k;
      ctx.beginPath(); ctx.moveTo(K[0], K[1]); ctx.lineTo(F[0], F[1]); ctx.stroke();
      ctx.beginPath(); ctx.arc(F[0], F[1], 2.3 * k, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    {
      const alpha = clamp(Math.abs(c) * 1.6 - 0.4, 0, 1) * (1 - P.haunch);
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
      ctx.globalAlpha = alpha;
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
  let running = false, last = 0;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  function stop() { running = false; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }

  // ------------------------------------------------------------------ behaviour
  const walkTo = (x) => new Promise((done) => {
    setPose("walk");
    s.goal = clamp(x, geo.min, Math.max(geo.min, geo.max));
    s.onGoal = () => { setPose("stand"); done(); };
  });
  const jumpTo = (gy) => new Promise((done) => { s.jump = { from: s.gy, to: gy, t: 0, dur: 0.55, done }; });
  const face = (deg) => { s.yawT = nearestAngle(deg, s.yaw); };

  async function outing() {
    measure();
    if (geo.max - geo.min < geo.reach * 4) return; // not enough room on small screens

    // Appear on the seat, sitting with its back to us like the logo cat.
    s.x = geo.home; s.gy = geo.seatDy; s.yaw = s.yawT = -105; s.v = 0; s.amp = 0;
    setPose("sit", true);
    start();
    canvas.classList.add("is-out");
    seat.style.opacity = "0";
    await sleep(800);
    setPose("stand");
    face(VIEW);
    await sleep(1100);
    await jumpTo(0);
    await sleep(400);

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

    // Home: slink back, turn our back to us, sit, hop up, and become the logo again.
    measure();
    await walkTo(geo.home);
    face(-105);
    await sleep(1100);
    setPose("sit");
    await sleep(700);
    await jumpTo(geo.seatDy);
    await sleep(450);
    seat.style.opacity = "";
    canvas.classList.remove("is-out");
    await sleep(450);
    stop();
  }

  if (location.hash === "#cat-debug") {
    window.__cat = { s, P, setPose, measure, start, draw, update, geo: () => geo, canvas, seat };
    return;
  }

  (async () => {
    await sleep(rand(2500, 4000));
    for (;;) {
      await outing();
      await sleep(rand(12000, 25000));
    }
  })();
})();
