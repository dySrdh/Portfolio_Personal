// The 3D journey: one continuous three.js world, camera flies between chapter landmarks as you scroll.
import * as T from 'three';

// The design was tuned on three r149: keep its colour handling and light units.
T.ColorManagement.enabled = false;

const PAL = {
  Dusk:     { top: '#17203c', mid: '#5d4f72', bot: '#e3a877', fog: '#6f5f78', fogD: 0.013, sun: '#ffc995', sunI: 1.7, hemiS: '#b7c1df', hemiG: '#3a2c28', hemiI: 0.7, star: 0.15 },
  Golden:   { top: '#2a3456', mid: '#8a6f6a', bot: '#f0b878', fog: '#8a7470', fogD: 0.011, sun: '#ffd49c', sunI: 2.0, hemiS: '#cfc6d8', hemiG: '#44342a', hemiI: 0.8, star: 0 },
  Twilight: { top: '#0e1530', mid: '#3a3a64', bot: '#b0788a', fog: '#3c3a5a', fogD: 0.013, sun: '#e6b0c0', sunI: 1.1, hemiS: '#7a84b8', hemiG: '#221c26', hemiI: 0.6, star: 0.5 },
  Night:    { top: '#050914', mid: '#0f1a36', bot: '#26365c', fog: '#141d38', fogD: 0.014, sun: '#9fb2ff', sunI: 0.7, hemiS: '#40528a', hemiG: '#0c0f18', hemiI: 0.5, star: 1 },
  Predawn:  { top: '#101a38', mid: '#3d4f7a', bot: '#c49aa0', fog: '#46506e', fogD: 0.013, sun: '#f0c8c0', sunI: 1.1, hemiS: '#8a9ac8', hemiG: '#2a2430', hemiI: 0.6, star: 0.55 },
  Dawn:     { top: '#3c5883', mid: '#a4b3cc', bot: '#f0cdb4', fog: '#aeb0c2', fogD: 0.011, sun: '#fff0d6', sunI: 2.0, hemiS: '#dfe6f5', hemiG: '#5a4a40', hemiI: 0.85, star: 0 }
};
const JOURNEY = ['Dusk', 'Golden', 'Golden', 'Twilight', 'Night', 'Predawn', 'Dawn'];

export function initWorld(host, shared) {
  const small = innerWidth < 700;
  let hi = true;
  // phones: skip MSAA on dense screens (aliasing is barely visible there) and render at a lighter pixel ratio
  const r = new T.WebGLRenderer({ antialias: !(small && devicePixelRatio >= 2), powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.3 : 2));
  r.setSize(host.clientWidth || innerWidth, host.clientHeight || innerHeight);
  r.outputColorSpace = T.SRGBColorSpace;
  r.useLegacyLights = true;
  r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 0.88;
  r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
  host.appendChild(r.domElement);
  // if the GPU drops the WebGL context (driver reset, too many GPU tabs), rebuild the world once it comes back
  r.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); host.classList.remove('is-ready'); }, false);
  r.domElement.addEventListener('webglcontextrestored', () => {
    try { sessionStorage.setItem('pf-scroll', String(scrollY)); } catch (err) { /* private mode */ }
    location.reload();
  }, false);
  const scene = new T.Scene();
  if (/[?&]debug3d/.test(location.search)) window.__scene = scene; // dev: inspect the scene from the console
  const cam = new T.PerspectiveCamera(42, (host.clientWidth || innerWidth) / (host.clientHeight || innerHeight), 0.1, 600);

  /* ---------- helpers ---------- */
  const hash = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };
  const jitter = (g, a) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = Math.round(x * 100) / 100, l = Math.round(y * 100) / 100, m = Math.round(z * 100) / 100; p.setXYZ(i, x + (hash(k, l, m) - .5) * a, y + (hash(l, m, k) - .5) * a * .6, z + (hash(m, k, l) - .5) * a); } g.computeVertexNormals(); return g; };
  const std = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, flatShading: false, roughness: 0.92, metalness: 0 }, o || {}));
  const nz = (x, y, z) => Math.sin(x * 1.7 + z * 0.9) * 0.5 + Math.sin(z * 2.3 - y * 1.3 + x * 0.4) * 0.3 + Math.sin(x * 4.1 + y * 3.7 + z * 3.3) * 0.15 + Math.sin(x * 9.3 - z * 8.1 + y * 6.7) * 0.06;
  const noiseTex = (base, spread, rep) => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const col = new T.Color(base);
    g.fillStyle = '#' + col.getHexString(); g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5200; i++) { const cc = col.clone().offsetHSL(0, 0, (Math.random() - 0.5) * spread); g.fillStyle = 'rgba(' + Math.round(cc.r * 255) + ',' + Math.round(cc.g * 255) + ',' + Math.round(cc.b * 255) + ',' + (0.35 + Math.random() * 0.5) + ')'; const s = 1 + Math.random() * 5; g.fillRect(Math.random() * 256, Math.random() * 256, s, s * (0.4 + Math.random())); }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
  };
  const TX = { grass: noiseTex('#6a8a4e', 0.14, 3), rock: noiseTex('#7a6a5a', 0.2, 2), earth: noiseTex('#8a6f55', 0.16, 2), stone: noiseTex('#b8ae98', 0.12, 1.5), bark: noiseTex('#5a4332', 0.18, 1) };
  const displace = (g, amp, freq, keepTop) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = nz(x * freq, y * freq, z * freq); const len = Math.hypot(x, z) || 1; const top = keepTop && y > keepTop; const k = top ? 0.25 : 1; p.setXYZ(i, x + x / len * n * amp * k, y + (top ? n * amp * 0.12 : n * amp * 0.35), z + z / len * n * amp * k); } g.computeVertexNormals(); return g; };
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c); })();
  const glowS = (color, s, op) => { const m = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: op == null ? 0.6 : op })); m.scale.set(s, s, 1); return m; };
  const stone = std('#ffffff', { map: TX.stone, roughness: 0.88 });
  const gold = new T.MeshStandardMaterial({ color: 0xd9b56a, emissive: 0x4a3510, emissiveIntensity: 0.5, metalness: 1, roughness: 0.28 });
  const V = (x, y, z) => new T.Vector3(x, y, z);

  const grassMats = {};
  const makeIsland = (rad, depth, grass) => {
    const g = new T.Group(), gk = grass || '#ffffff';
    const gm = grassMats[gk] || (grassMats[gk] = std(grass || '#ffffff', { map: TX.grass, color: grass ? new T.Color(grass).lerp(new T.Color('#ffffff'), 0.55) : 0xffffff }));
    const top = new T.Mesh(displace(new T.CylinderGeometry(rad, rad * 0.95, 0.9, 40, 2), rad * 0.06, 0.9, 0.3), gm); top.receiveShadow = top.castShadow = true; g.add(top);
    const band = new T.Mesh(displace(new T.CylinderGeometry(rad * 0.96, rad * 0.78, 1.0, 40, 2), rad * 0.09, 1.1), std('#ffffff', { map: TX.earth })); band.position.y = -0.85; band.castShadow = true; g.add(band);
    const rock = new T.Mesh(displace(new T.ConeGeometry(rad * 0.8, depth, 40, 9), rad * 0.2, 0.75), std('#ffffff', { map: TX.rock, roughness: 0.95 })); rock.rotation.x = Math.PI; rock.position.y = -depth / 2 - 1.3; rock.castShadow = true; g.add(rock);
    return g;
  };
  const leafMats = ['#2f4a37', '#3b5a3a', '#4a6a3c', '#35503f'].map(c => std(c, { roughness: 0.85 }));
  const barkMat = std('#ffffff', { map: TX.bark });
  let treeN = 0;
  const makeTree = (s) => {
    const t = new T.Group(), k = treeN++;
    const trunk = new T.Mesh(new T.CylinderGeometry(0.07 * s, 0.13 * s, 1.1 * s, 10), barkMat); trunk.position.y = 0.55 * s; trunk.castShadow = true; t.add(trunk);
    if (k % 3 === 0) {
      [[0.95, 1.3, 1.0], [0.75, 1.1, 1.55], [0.5, 0.9, 2.05]].forEach(([rr, hh, yy], j) => { const c = new T.Mesh(displace(new T.ConeGeometry(rr * s, hh * s, 18, 4), 0.06 * s, 3), leafMats[(k + j) % 4]); c.position.y = yy * s; c.castShadow = true; t.add(c); });
    } else {
      const n = 5 + (k % 3);
      for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2 + k, rr = j === 0 ? 0 : 0.42 * s; const b = new T.Mesh(displace(new T.IcosahedronGeometry((0.42 + hash(k, j, 3) * 0.2) * s, 1), 0.07 * s, 4), leafMats[(k + j) % 4]); b.position.set(Math.cos(a) * rr, (1.25 + (j === 0 ? 0.35 : hash(j, k, 9) * 0.35)) * s, Math.sin(a) * rr); b.castShadow = true; t.add(b); }
    }
    return t;
  };
  const ring = (n, R, fn) => { for (let i = 0; i < n; i++) fn(i / n * Math.PI * 2, R, i); };
  const at = (obj, base, x, y, z) => { obj.position.set(base.x + x, base.y + y, base.z + z); scene.add(obj); return obj; };

  /* ---------- sky, stars, lights ---------- */
  const skyU = { top: { value: new T.Color() }, mid: { value: new T.Color() }, bot: { value: new T.Color() } };
  const sky = new T.Mesh(new T.SphereGeometry(300, 32, 16), new T.ShaderMaterial({
    uniforms: skyU, side: T.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float y = vP.y; vec3 c = y > 0.05 ? mix(mid, top, smoothstep(0.05, 0.6, y)) : mix(bot, mid, smoothstep(-0.25, 0.05, y)); gl_FragColor = vec4(c,1.0); }'
  }));
  scene.add(sky);
  const pmrem = new T.PMREMGenerator(r);
  const envScene = new T.Scene(); envScene.add(new T.Mesh(new T.SphereGeometry(50, 32, 16), sky.material));
  let envRT = null;
  const updateEnv = () => { const rt = pmrem.fromScene(envScene, 0.02); if (envRT) envRT.dispose(); envRT = rt; scene.environment = rt.texture; };
  const SN = 900, sp = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) { const u = Math.random(), v = Math.random() * 0.9 + 0.1; const th = u * Math.PI * 2, ph = Math.acos(v); sp[i * 3] = Math.sin(ph) * Math.cos(th) * 260; sp[i * 3 + 1] = Math.cos(ph) * 260; sp[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 260; }
  const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3));
  const starMat = new T.PointsMaterial({ size: 1.6, sizeAttenuation: false, color: 0xffffff, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new T.Points(sg, starMat); scene.add(stars);
  scene.fog = new T.FogExp2(0x000000, 0.013);

  const hemi = new T.HemisphereLight(0xffffff, 0x222222, 0.7); scene.add(hemi);
  const sun = new T.DirectionalLight(0xffffff, 2); sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536); sun.shadow.radius = 4; sun.shadow.normalBias = 0.04;
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 80 }); sun.shadow.bias = -0.0015;
  scene.add(sun); scene.add(sun.target);

  /* ---------- L0 Crystal Shrine ---------- */
  const L0 = V(0, 0, 0);
  at(makeIsland(6, 7.5), L0, 0, 0, 0);
  const dais = at(new T.Mesh(new T.CylinderGeometry(1.7, 1.95, 0.4, 8), stone), L0, 0, 0.62, 0); dais.receiveShadow = dais.castShadow = true;
  at(new T.Mesh(new T.CylinderGeometry(1.2, 1.35, 0.25, 8), stone), L0, 0, 0.95, 0).castShadow = true;
  [2.6, 2.6, 1.3, 2.6, 0.7, 2.6, 2.6, 1.8].forEach((hh, i) => {
    const a = i / 8 * Math.PI * 2 + 0.2, R = 3.5, cx = Math.cos(a) * R, cz = Math.sin(a) * R;
    const col = at(new T.Mesh(jitter(new T.CylinderGeometry(0.26, 0.3, hh, 8), 0.03), stone), L0, cx, 0.45 + hh / 2, cz); col.castShadow = col.receiveShadow = true;
    at(new T.Mesh(new T.BoxGeometry(0.75, 0.2, 0.75), stone), L0, cx, 0.52, cz).rotation.y = -a;
    if (hh > 2) { const cap = at(new T.Mesh(new T.BoxGeometry(0.7, 0.18, 0.7), stone), L0, cx, 0.45 + hh + 0.09, cz); cap.rotation.y = -a; cap.castShadow = true; }
  });
  const la = 0.2 + Math.PI / 8; const lin = at(new T.Mesh(new T.BoxGeometry(3.0, 0.22, 0.5), stone), L0, Math.cos(la) * 3.25, 3.3, Math.sin(la) * 3.25); lin.rotation.y = -la + Math.PI / 2; lin.castShadow = true;
  [1.6, 2.9, 3.6, 4.4, 5.3, 6.0].forEach((a, i) => { const R = 4.7 + hash(i + 1, 3, 1) * 0.6; at(makeTree(0.8 + hash(i + 1, 1, 2) * 0.5), L0, Math.cos(a) * R, 0.4, Math.sin(a) * R); }); // none in front of the hero
  const heroCry = new T.MeshPhysicalMaterial({ color: 0x9feee4, emissive: 0x2a8a80, emissiveIntensity: 0.55, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, flatShading: true, transparent: true, opacity: 0.9 });
  const cryLite = new T.MeshStandardMaterial({ color: 0x9feee4, emissive: 0x2a8a80, emissiveIntensity: 0.8, roughness: 0.08, metalness: 0.3, flatShading: true, transparent: true, opacity: 0.9, envMapIntensity: 1.5 });
  const crystal = at(new T.Mesh(new T.OctahedronGeometry(1, 0), heroCry), L0, 0, 3.3, 0); crystal.scale.set(0.75, 1.55, 0.75); crystal.castShadow = true;
  const shards = new T.Group(); scene.add(shards);
  for (let i = 0; i < 3; i++) { const s = new T.Mesh(new T.OctahedronGeometry(0.22, 0), cryLite); s.scale.y = 1.8; s.userData.a = i / 3 * Math.PI * 2; shards.add(s); }
  const cGlow = at(glowS(0x8fe3d8, 7, 0.55), L0, 0, 3.3, 0);
  const cryLight = at(new T.PointLight(0x8fe3d8, 2.5, 22, 1.6), L0, 0, 3.3, 0);
  const ring1 = at(new T.Mesh(new T.TorusGeometry(2.0, 0.025, 8, 96), gold), L0, 0, 3.3, 0); ring1.rotation.x = Math.PI / 2.3;
  const ring2 = at(new T.Mesh(new T.TorusGeometry(2.35, 0.018, 8, 96), gold), L0, 0, 3.3, 0); ring2.rotation.x = Math.PI / 1.7; ring2.rotation.y = 0.5;

  /* ---------- L1 Adventurer's Camp ---------- */
  const L1 = V(26, 2, -18);
  at(makeIsland(5, 6), L1, 0, 0, 0);
  const tent = at(new T.Mesh(new T.ConeGeometry(1.7, 2.3, 4), std('#7e3a2e')), L1, -1.4, 1.6, 0.3); tent.rotation.y = Math.PI / 4 + 0.3; tent.castShadow = true;
  const tent2 = at(new T.Mesh(new T.ConeGeometry(1.1, 1.6, 4), std('#bfa983')), L1, -2.6, 1.25, -1.8); tent2.rotation.y = 0.2; tent2.castShadow = true;
  for (let i = 0; i < 3; i++) { const lg = at(new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 1, 5), std('#4a3526')), L1, 1.3, 0.55, 1.2); lg.rotation.z = Math.PI / 2; lg.rotation.y = i / 3 * Math.PI; }
  const flame = at(new T.Mesh(new T.ConeGeometry(0.28, 0.8, 6), new T.MeshBasicMaterial({ color: 0xffb04a })), L1, 1.3, 0.95, 1.2);
  const fGlow = at(glowS(0xff9a3a, 3.2, 0.8), L1, 1.3, 1.0, 1.2);
  const fLight = at(new T.PointLight(0xff9a3a, 3, 12, 1.8), L1, 1.3, 1.4, 1.2);
  ring(6, 0.9, (a) => at(new T.Mesh(jitter(new T.DodecahedronGeometry(0.16, 0), 0.04), std('#7d7466')), L1, 1.3 + Math.cos(a) * 0.55, 0.5, 1.2 + Math.sin(a) * 0.55));
  at(new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 3.4, 5), std('#4a3526')), L1, 2.4, 2.1, -1.4);
  const banner = at(new T.Mesh(new T.PlaneGeometry(1.0, 1.6, 6, 6), new T.MeshStandardMaterial({ color: 0xd9b56a, side: T.DoubleSide, roughness: 0.8, emissive: 0x3a2a10 })), L1, 2.93, 2.9, -1.4); banner.castShadow = true;
  [0.4, 2.2, 3.6, 5.0].forEach((a, i) => at(makeTree(0.9 + hash(i, 4, 4) * 0.4), L1, Math.cos(a) * 3.8, 0.4, Math.sin(a) * 3.8));

  /* ---------- L2 Training Grounds: one obelisk per skill ---------- */
  const L2 = V(8, 6, -46);
  at(makeIsland(8, 9, '#5d7648'), L2, 0, 0, 0);
  const rune = at(new T.Mesh(new T.TorusGeometry(2.2, 0.05, 6, 80), gold), L2, 0, 0.5, 0); rune.rotation.x = -Math.PI / 2;
  const rune2 = at(new T.Mesh(new T.TorusGeometry(1.4, 0.035, 6, 60), gold), L2, 0, 0.5, 0); rune2.rotation.x = -Math.PI / 2;
  at(new T.Mesh(new T.CylinderGeometry(2.6, 2.8, 0.1, 24), stone), L2, 0, 0.47, 0).receiveShadow = true;
  const obeliskRoot = new T.Group(); scene.add(obeliskRoot);
  let obelisks = [];
  const buildObelisks = (pcts) => {
    obeliskRoot.clear();
    const n = pcts.length;
    obelisks = pcts.map((pct, i) => {
      const th = (100 + (n > 1 ? i / (n - 1) : 0.5) * 160) * Math.PI / 180, R = 5.4, h = 0.8 + pct / 100 * 5.2;
      const g = new T.Group(); g.position.set(L2.x + Math.sin(th) * R, L2.y + 0.45, L2.z + Math.cos(th) * R); g.rotation.y = th; obeliskRoot.add(g);
      const body = new T.Mesh(new T.BoxGeometry(0.62, 1, 0.62), stone); body.castShadow = true; body.position.y = 0.5; g.add(body);
      const tipMat = new T.MeshStandardMaterial({ color: 0xd9b56a, emissive: 0xd9b56a, emissiveIntensity: 0.3, metalness: 0.6, roughness: 0.3, flatShading: true, envMapIntensity: 0.3 });
      const tip = new T.Mesh(new T.OctahedronGeometry(0.3, 0), tipMat); tip.scale.y = 1.6; g.add(tip);
      const gl = glowS(0xe2c07e, 1.6, 0.3); g.add(gl);
      return { body, tip, tipMat, gl, h, cur: 0.05 };
    });
  };
  [0.5, 1.2, 5.4, 6.0].forEach((a, i) => at(makeTree(1 + hash(i, 8, 1) * 0.4), L2, Math.cos(a) * 6.5, 0.4, Math.sin(a) * 6.5));

  /* ---------- L3 Guild Isles ---------- */
  const L3 = V(-26, 2, -40);
  at(makeIsland(4.5, 6), L3, 0, 0, 0);
  [-1.3, 1.3].forEach(x => { at(new T.Mesh(new T.BoxGeometry(0.6, 3.6, 0.6), stone), L3, x, 2.25, 0).castShadow = true; });
  at(new T.Mesh(new T.BoxGeometry(3.6, 0.4, 0.8), stone), L3, 0, 4.2, 0).castShadow = true;
  at(new T.Mesh(new T.TorusGeometry(1.0, 0.06, 6, 40, Math.PI), gold), L3, 0, 3.0, 0.32);
  const isles = [];
  // internship · campus · organisational · work
  [V(-8, 1.2, 3), V(0, 3.2, -7.5), V(8, 0.4, 3), V(-12.5, 4.2, -6)].forEach((o, idx) => {
    const base = V(L3.x + o.x, L3.y + o.y, L3.z + o.z);
    const g = makeIsland(2.4, 3.6); g.position.copy(base); scene.add(g);
    if (idx === 0) { const s = new T.Mesh(new T.OctahedronGeometry(0.6, 0), cryLite); s.scale.y = 2.2; s.position.y = 2; g.add(s); }
    if (idx === 1) { const tw = new T.Mesh(new T.CylinderGeometry(0.6, 0.75, 3, 8), stone); tw.position.y = 1.9; tw.castShadow = true; g.add(tw); const rf = new T.Mesh(new T.ConeGeometry(0.95, 1.3, 8), std('#35456a')); rf.position.y = 4.05; rf.castShadow = true; g.add(rf); }
    if (idx === 3) { // the workshop: a small hall under a turning gold ring
      const hall = new T.Mesh(new T.BoxGeometry(1.6, 1.2, 1.3), stone); hall.position.y = 1.05; hall.castShadow = true; g.add(hall);
      const roof = new T.Mesh(new T.ConeGeometry(1.25, 0.9, 4), std('#7e3a2e')); roof.position.y = 2.1; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
      const cog = new T.Mesh(new T.TorusGeometry(0.55, 0.07, 6, 12), gold); cog.position.y = 3.1; g.add(cog); g.userData.cog = cog;
    }
    if (idx === 2) { ['#7e3a2e', '#bfa983', '#35456a'].forEach((c, j) => { const a = j / 3 * Math.PI * 2; const t = new T.Mesh(new T.ConeGeometry(0.6, 1.1, 4), std(c)); t.position.set(Math.cos(a), 1.0, Math.sin(a)); t.castShadow = true; g.add(t); }); }
    const gl = glowS(0xe2c07e, 6, 0.0); gl.position.y = 2.2; g.add(gl);
    isles.push({ g, gl, base, ph: idx * 1.7 });
  });

  /* ---------- L4 Relic Vault: a ring of certificates ---------- */
  const L4 = V(-36, 11, -8);
  at(makeIsland(3, 5), L4, 0, -4.2, 0);
  at(new T.Mesh(new T.CylinderGeometry(0.5, 0.8, 1.6, 8), stone), L4, 0, -3.1, 0);
  const orb = at(new T.Mesh(new T.IcosahedronGeometry(0.55, 1), new T.MeshStandardMaterial({ color: 0xbfe7ff, emissive: 0x6fb8ff, emissiveIntensity: 1.2, flatShading: true })), L4, 0, -1.4, 0);
  at(glowS(0x9fd0ff, 5, 0.6), L4, 0, -1.4, 0);
  at(new T.PointLight(0x9fd0ff, 2, 18, 1.6), L4, 0, 0, 3);
  at(makeIsland(1.2, 2.2), L4, 2.2, -3.05, 9.2); // the hero's lookout in front of the vault
  const vault = new T.Group(); vault.position.copy(L4); scene.add(vault);
  let vaultRot = 0, vaultR = 7.6, relics = [];
  const loader = new T.TextureLoader(); loader.setCrossOrigin('anonymous');
  const frameGeo = new T.BoxGeometry(3.5, 2.55, 0.1), plateGeo = new T.PlaneGeometry(3.3, 2.34);
  const buildVault = (list) => {
    relics.forEach(rl => { if (rl.mat.map) rl.mat.map.dispose(); rl.mat.dispose(); });
    vault.clear();
    const n = list.length;
    vaultR = Math.max(6.5, n * 0.95);
    relics = list.map((src, i) => {
      const a = i / n * Math.PI * 2;
      const g = new T.Group(); g.position.set(Math.sin(a) * vaultR, 0, Math.cos(a) * vaultR); g.rotation.y = a;
      const frame = new T.Mesh(frameGeo, gold); frame.position.z = -0.06; g.add(frame);
      const mat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
      loader.load(src, tex => { tex.colorSpace = T.SRGBColorSpace; mat.map = tex; mat.needsUpdate = true; });
      g.add(new T.Mesh(plateGeo, mat));
      vault.add(g);
      return { g, mat, a };
    });
    buildPath();
  };

  /* ---------- L5 Long Road ---------- */
  const rs = V(-22, 4, 12), re = V(-2, 4.5, 30), roadMid = V((rs.x + re.x) / 2, 4.5, (rs.z + re.z) / 2);
  const lanterns = [];
  for (let i = 0; i < 7; i++) {
    const t = i / 6, p = V(rs.x + (re.x - rs.x) * t, rs.y + Math.sin(t * Math.PI) * 1.5 + (re.y - rs.y) * t, rs.z + (re.z - rs.z) * t + Math.sin(t * Math.PI * 2) * 2.5);
    const g = makeIsland(1.3 + hash(i, 1, 9) * 0.4, 2.2); g.position.copy(p); scene.add(g);
    const post = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 1.6, 5), std('#4a3526')); post.position.set(0.6, 1.2, 0); g.add(post);
    const lampMat = new T.MeshBasicMaterial({ color: 0x5a4a30 });
    const lamp = new T.Mesh(new T.BoxGeometry(0.28, 0.34, 0.28), lampMat); lamp.position.set(0.6, 2.1, 0); g.add(lamp);
    const gl = glowS(0xffc46a, 2.4, 0); gl.position.set(0.6, 2.1, 0); g.add(gl);
    lanterns.push({ lampMat, gl, g, y: p.y, ph: i });
  }

  /* ---------- L6 Beacon ---------- */
  const L6 = V(20, 0, 28);
  at(makeIsland(5, 7), L6, 0, 0, 0);
  at(new T.Mesh(jitter(new T.CylinderGeometry(1.0, 1.6, 8, 8, 3), 0.08), stone), L6, 0, 4.4, 0).castShadow = true;
  at(new T.Mesh(new T.CylinderGeometry(1.5, 1.2, 0.35, 8), stone), L6, 0, 8.55, 0);
  ring(6, 1.25, (a) => at(new T.Mesh(new T.BoxGeometry(0.16, 0.9, 0.16), stone), L6, Math.cos(a) * 1.25, 9.15, Math.sin(a) * 1.25));
  at(new T.Mesh(new T.ConeGeometry(1.6, 1.2, 8), std('#35456a')), L6, 0, 10.2, 0).castShadow = true;
  const fire = at(new T.Mesh(new T.OctahedronGeometry(0.45, 0), new T.MeshBasicMaterial({ color: 0xffd08a })), L6, 0, 9.1, 0);
  const bGlow = at(glowS(0xffc46a, 6, 0.7), L6, 0, 9.1, 0);
  const bLight = at(new T.PointLight(0xffc46a, 3, 30, 1.5), L6, 0, 9.1, 0);
  const beamMat = new T.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.12, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
  at(new T.Mesh(new T.CylinderGeometry(3.5, 0.5, 40, 24, 1, true), beamMat), L6, 0, 30.8, 0);
  [1.0, 4.0, 5.2].forEach(a => at(makeTree(0.9), L6, Math.cos(a) * 3.8, 0.4, Math.sin(a) * 3.8));

  /* ---------- ambient: islets, clouds, cloud sea, motes ---------- */
  const drift = [];
  [[14, 4, -30, 1.4], [-12, 6, -20, 1.2], [-44, 3, -26, 1.6], [34, 6, 6, 1.3], [-18, 9, 34, 1.1], [42, -2, -32, 1.8], [-6, -3, 16, 1.2], [6, 10, 12, 0.9]].forEach(([x, y, z, s], i) => {
    const g = makeIsland(s, s * 1.9); g.position.set(x, y, z);
    if (i % 2 === 0) { const t = makeTree(0.7); t.position.y = 0.4; g.add(t); }
    scene.add(g); drift.push({ g, y, ph: i * 1.3 });
  });
  const clouds = [];
  const cloudMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.82, emissive: 0x404858, emissiveIntensity: 0.25 });
  for (let i = 0; i < 18; i++) {
    const c = new T.Group();
    for (let j = 0; j < 7; j++) { const b = new T.Mesh(displace(new T.IcosahedronGeometry(1 + hash(i, j, 1) * 1.4, 2), 0.25, 1.4), cloudMat); b.position.set((j - 3) * 1.15, hash(j, i, 4) * 0.8, hash(i, j, 8) * 1.6 - 0.8); b.scale.y = 0.55; c.add(b); }
    c.position.set(-60 + hash(i, 5, 5) * 120, -10 - hash(i, 1, 1) * 8 + (i % 4 === 0 ? 22 : 0), -70 + hash(i, 6, 2) * 120);
    c.userData.s = 0.2 + hash(i, 2, 2) * 0.3; scene.add(c); clouds.push(c);
  }
  const seaTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); for (let i = 0; i < 420; i++) { const x = Math.random() * 512, y = Math.random() * 512, rr = 20 + Math.random() * 70; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(255,255,255,' + (0.08 + Math.random() * 0.12) + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]].forEach(([ox, oy]) => { g.save(); g.translate(ox, oy); g.fillRect(x - rr, y - rr, rr * 2, rr * 2); g.restore(); }); } const tx = new T.CanvasTexture(c); tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.repeat.set(5, 5); return tx; })();
  const seaMat = new T.MeshBasicMaterial({ map: seaTex, transparent: true, opacity: 0.8, depthWrite: false, color: 0xffffff });
  const seaM = new T.Mesh(new T.PlaneGeometry(700, 700), seaMat); seaM.rotation.x = -Math.PI / 2; seaM.position.y = -17; scene.add(seaM);
  const seaMat2 = seaMat.clone(); seaMat2.map = seaTex.clone(); seaMat2.map.needsUpdate = true; seaMat2.opacity = 0.45;
  const seaM2 = new T.Mesh(new T.PlaneGeometry(700, 700), seaMat2); seaM2.rotation.x = -Math.PI / 2; seaM2.position.y = -14.5; scene.add(seaM2);
  const N = 1200, mp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { mp[i * 3] = -55 + Math.random() * 90; mp[i * 3 + 1] = -4 + Math.random() * 20; mp[i * 3 + 2] = -60 + Math.random() * 100; }
  const mg = new T.BufferGeometry(); mg.setAttribute('position', new T.BufferAttribute(mp, 3));
  const moteMat = new T.PointsMaterial({ size: 0.24, map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, color: 0xf1cf8e, opacity: 0.85 });
  const motes = new T.Points(mg, moteMat); scene.add(motes);

  /* ---------- polish: grass, flowers, waterfalls, birds, mountains, hanging crystals, runes, rays, sky lanterns ---------- */
  const scatter = (c, rad, avoid, n) => {
    const gg = new T.ConeGeometry(0.05, 0.34, 3); gg.translate(0, 0.17, 0);
    const im = new T.InstancedMesh(gg, new T.MeshStandardMaterial({ flatShading: true, roughness: 1 }), n);
    const fl = new T.InstancedMesh(new T.IcosahedronGeometry(0.06, 0), new T.MeshStandardMaterial({ roughness: 0.6, emissiveIntensity: 0.25 }), Math.floor(n / 6));
    const d = new T.Object3D(), col = new T.Color(); let k = 0, q = 0;
    for (let i = 0; i < n * 2 && k < n; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * rad; if (rr < avoid) continue;
      d.position.set(c.x + Math.cos(a) * rr, c.y + 0.45, c.z + Math.sin(a) * rr); d.rotation.set((Math.random() - .5) * 0.5, Math.random() * 3, (Math.random() - .5) * 0.5); d.scale.setScalar(0.6 + Math.random() * 0.9); d.updateMatrix();
      im.setMatrixAt(k, d.matrix); im.setColorAt(k, col.setHSL(0.24 + Math.random() * 0.06, 0.35, 0.28 + Math.random() * 0.14)); k++;
      if (q < fl.count && Math.random() < 0.18) { d.scale.setScalar(1); d.position.y += 0.3; d.updateMatrix(); fl.setMatrixAt(q, d.matrix); fl.setColorAt(q, col.set(['#f3eee3', '#e8c887', '#d8a0b0', '#9fd6e0'][q % 4])); q++; }
    }
    im.count = k; fl.count = q; im.receiveShadow = true; scene.add(im); scene.add(fl);
  };
  scatter(L0, 5.6, 2.2, 700); scatter(L1, 4.6, 0, 420); scatter(L2, 7.4, 3.0, 700); scatter(L3, 4.1, 1.8, 300); scatter(L6, 4.6, 1.8, 380);
  const fallTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'); for (let i = 0; i < 70; i++) { const x = Math.random() * 64, w = 1 + Math.random() * 3, y = Math.random() * 256, h = 30 + Math.random() * 120; const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,' + (0.3 + Math.random() * 0.5) + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x, y, w, h); g.fillRect(x, y - 256, w, h); } const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t; })();
  const falls = [];
  const addFall = (c, ang, rad, h, w) => {
    const mat = new T.MeshBasicMaterial({ map: fallTex.clone(), color: 0xdff4ff, transparent: true, opacity: 0.85, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending });
    mat.map.needsUpdate = true; mat.map.repeat.set(1, h / 5);
    const pl = new T.Mesh(new T.PlaneGeometry(w, h), mat); pl.position.set(c.x + Math.cos(ang) * (rad + 0.1), c.y + 0.3 - h / 2, c.z + Math.sin(ang) * (rad + 0.1)); pl.rotation.y = -ang + Math.PI / 2; scene.add(pl);
    const st = new T.Mesh(new T.BoxGeometry(0.1, 0.06, w * 0.9), new T.MeshStandardMaterial({ color: 0x7fc6d6, emissive: 0x2a6070, roughness: 0.2 })); st.position.set(c.x + Math.cos(ang) * (rad - 0.9), c.y + 0.47, c.z + Math.sin(ang) * (rad - 0.9)); st.scale.x = 18; st.rotation.y = -ang; scene.add(st);
    const mist = glowS(0xffffff, 5, 0.35); mist.position.set(pl.position.x, c.y + 0.3 - h, pl.position.z); scene.add(mist);
    falls.push(mat);
  };
  addFall(L0, 0.55, 6, 11, 1.3); addFall(L1, 2.6, 5, 8, 0.9); addFall(L2, 1.0, 8, 13, 1.6);
  const birds = [];
  const birdMat = new T.MeshBasicMaterial({ color: 0x1a1a24, side: T.DoubleSide });
  const wg = new T.BufferGeometry(); wg.setAttribute('position', new T.BufferAttribute(new Float32Array([0, 0, 0, 0.5, 0, -0.12, 0, 0, -0.28]), 3));
  for (let i = 0; i < 9; i++) {
    const b = new T.Group();
    const l = new T.Mesh(wg, birdMat), rgt = new T.Mesh(wg, birdMat); rgt.scale.x = -1; b.add(l); b.add(rgt);
    b.scale.setScalar(0.8 + Math.random() * 0.4);
    const c = [L0, L1, L2, L3, L6][i % 5];
    b.userData = { c, r: 9 + Math.random() * 6, y: c.y + 7 + Math.random() * 4, sp: 0.15 + Math.random() * 0.12, ph: Math.random() * 6, l, rgt };
    scene.add(b); birds.push(b);
  }
  const mtnMat = new T.MeshBasicMaterial({ color: 0x3a4460, fog: false });
  for (let i = 0; i < 44; i++) { const a = i / 44 * Math.PI * 2 + hash(i, 3, 3) * 0.15, Rr = 245 + hash(i, 4, 4) * 35, h = 26 + hash(i, 5, 5) * 38; const mt = new T.Mesh(jitter(new T.ConeGeometry(34 + hash(i, 6, 6) * 30, h, 7, 4), 7), mtnMat); mt.position.set(Math.cos(a) * Rr, -34 + h / 2, Math.sin(a) * Rr); scene.add(mt); }
  const hangers = [];
  const hang = (c, depth, n) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + hash(i, c.x, 1) * 2, rr = 0.8 + hash(i, 2, c.z) * 1.6; const s = new T.Mesh(new T.OctahedronGeometry(0.28 + hash(i, 7, c.x) * 0.3, 0), cryLite); s.scale.y = 2.4; s.position.set(c.x + Math.cos(a) * rr, c.y - depth * 0.55 - 1.2 - hash(i, 1, c.z) * depth * 0.35, c.z + Math.sin(a) * rr); scene.add(s); const gl = glowS(0x8fe3d8, 1.8, 0.45); gl.position.copy(s.position); scene.add(gl); hangers.push({ s, gl, y: s.position.y, ph: i + c.x * 0.3 }); } };
  hang(L0, 7.5, 5); hang(L1, 6, 3); hang(L2, 9, 5); hang(L3, 6, 3); hang(L6, 7, 4);
  const runeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.translate(256, 256); g.strokeStyle = 'rgba(255,225,160,1)'; g.fillStyle = 'rgba(255,225,160,1)'; g.lineWidth = 4; [240, 200, 120].forEach(rr => { g.beginPath(); g.arc(0, 0, rr, 0, Math.PI * 2); g.stroke(); }); g.lineWidth = 2; for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 205, Math.sin(a) * 205); g.lineTo(Math.cos(a) * (i % 4 ? 222 : 236), Math.sin(a) * (i % 4 ? 222 : 236)); g.stroke(); } for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.save(); g.translate(Math.cos(a) * 160, Math.sin(a) * 160); g.rotate(Math.PI / 4); g.fillRect(-9, -9, 18, 18); g.restore(); } g.beginPath(); for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI * 2 - Math.PI / 2; const x = Math.cos(a) * 120, y = Math.sin(a) * 120; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); return new T.CanvasTexture(c); })();
  const runeMat = new T.MeshBasicMaterial({ map: runeTex, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false });
  const runeDisc = at(new T.Mesh(new T.PlaneGeometry(3.2, 3.2), runeMat), L0, 0, 1.09, 0); runeDisc.rotation.x = -Math.PI / 2;
  const rays = [];
  for (let i = 0; i < 3; i++) { const m2 = new T.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.05, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }); const ray = new T.Mesh(new T.CylinderGeometry(0.6 + i * 0.5, 2.2 + i * 0.9, 26, 20, 1, true), m2); ray.position.set(-5 + i * 0.8, 13, 3 - i * 0.6); ray.rotation.z = -0.45; ray.rotation.x = 0.25; scene.add(ray); rays.push(m2); }
  const skyL = [];
  const skyLCore = new T.BoxGeometry(0.12, 0.16, 0.12), skyLMat = new T.MeshBasicMaterial({ color: 0xffd9a0 });
  for (let i = 0; i < 46; i++) { const spr = glowS(0xffb45a, 1.3, 0.8); const g2 = new T.Group(); g2.add(spr); g2.add(new T.Mesh(skyLCore, skyLMat)); g2.position.set(-50 + Math.random() * 90, -6 + Math.random() * 30, -60 + Math.random() * 100); g2.userData = { sp: 0.25 + Math.random() * 0.35, ph: Math.random() * 6 }; scene.add(g2); skyL.push(g2); }
  const sunGlow = glowS(0xffd9a0, 90, 0.5); sunGlow.material.fog = false; scene.add(sunGlow);

  /* ---------- the Oracle's Isle: Doddy at Lv 23 beside a crystal orb that speaks for him ---------- */
  const L7 = V(40, 4, 26);
  at(makeIsland(5.5, 7.5, '#5d7648'), L7, 0, 0, 0);
  const oracleRune = at(new T.Mesh(new T.PlaneGeometry(4.6, 4.6), new T.MeshBasicMaterial({ map: runeTex, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false })), L7, 0, 0.5, 0);
  oracleRune.rotation.x = -Math.PI / 2;
  const oracleCrystals = [];
  ring(6, 3.6, (a, R, i) => {
    const c = at(new T.Mesh(new T.OctahedronGeometry(0.28 + (i % 2) * 0.12, 0), cryLite), L7, Math.cos(a) * R, 1.1 + (i % 2) * 0.3, Math.sin(a) * R);
    c.scale.y = 2.2; oracleCrystals.push(c);
  });
  [0.3, 2.4, 3.7].forEach(a => at(makeTree(1), L7, Math.cos(a) * 4.6, 0.4, Math.sin(a) * 4.6));
  // the orb: no face, just light — teal when speaking, gold when listening, flickering while thinking
  const orb3 = new T.Group(); scene.add(orb3);
  const orbMat = new T.MeshStandardMaterial({ color: 0x9feee4, emissive: 0x2a8a80, emissiveIntensity: 1.2, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.92 });
  const orbCore = new T.Mesh(new T.IcosahedronGeometry(0.42, 3), orbMat); orb3.add(orbCore);
  const orbRings = [0, 1].map(i => { const r = new T.Mesh(new T.TorusGeometry(0.72 + i * 0.16, 0.022, 8, 64), gold); r.rotation.x = Math.PI / 2 + (i ? 0.5 : -0.4); orb3.add(r); return r; });
  const orbGlow = glowS(0x8fe3d8, 3.2, 0.7); orb3.add(orbGlow);
  const orbLight = new T.PointLight(0x8fe3d8, 2, 10, 1.6); orb3.add(orbLight);
  const orbHome = V(L7.x - 2.0, L7.y + 2.6, L7.z + 1.6); // on the side away from the chat panel
  orb3.position.copy(orbHome);
  const ORB_COL = { speaking: new T.Color(0x8fe3d8), listening: new T.Color(0xf1cf8e), thinking: new T.Color(0xbfa6ff), idle: new T.Color(0x8fe3d8) };
  const orbCol = new T.Color(0x8fe3d8);
  let orbAmp = 0, oracleMix = 0;
  function updateOracleIsle(dt, t, m) {
    const mode = shared.oracleMode || 'idle';
    orbAmp += ((shared.oracleAmp || 0) - orbAmp) * Math.min(1, dt * 12);
    const flicker = mode === 'thinking' ? 0.25 + Math.sin(t * 9) * 0.15 : 0;
    const a = Math.max(orbAmp, flicker);
    orbCol.lerp(ORB_COL[mode] || ORB_COL.idle, Math.min(1, dt * 4));
    orbMat.color.copy(orbCol); orbMat.emissive.copy(orbCol).multiplyScalar(0.45 + a * 0.9);
    orbGlow.material.color.copy(orbCol); orbLight.color.copy(orbCol);
    orbCore.scale.setScalar(1 + a * 0.28 + Math.sin(t * 1.6) * 0.03 * m);
    orbGlow.scale.setScalar(3.2 * (1 + a * 0.9)); orbGlow.material.opacity = 0.55 + a * 0.4;
    orbLight.intensity = 1.6 + a * 5;
    orbRings[0].rotation.z += dt * (0.4 + a * 3) * m; orbRings[1].rotation.z -= dt * (0.3 + a * 2.4) * m;
    orb3.position.set(orbHome.x, orbHome.y + Math.sin(t * 1.1) * 0.12 * m, orbHome.z);
    oracleRune.rotation.z += dt * (0.1 + a * 0.6) * m;
    oracleCrystals.forEach((c, i) => { c.rotation.y += dt * 0.5 * m; c.position.y = L7.y + 1.1 + (i % 2) * 0.3 + Math.sin(t + i) * 0.12 * m; });
  }

  /* ---------- the hero: Doddy as a low-poly adventurer who levels up chapter by chapter ---------- */
  const HERO_SCALE = 1.55;
  const hero = new T.Group(); hero.scale.setScalar(HERO_SCALE); scene.add(hero);
  const body = new T.Group(); hero.add(body);
  const cl = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.78, metalness: 0 }, o || {}));
  const mk = (geo, m, x, y, z, parent) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; (parent || body).add(o); return o; };
  const HM = { skin: cl('#e6bf9c'), hair: cl('#15100e'), shirt: cl('#f4f1ea'), pants: cl('#1f2a4a'), shoe: cl('#2b221c'), eye: new T.MeshBasicMaterial({ color: 0x120e0c }) };
  // legs, shoes, torso
  const legGeo = new T.CylinderGeometry(0.085, 0.08, 0.46, 10);
  const legL = mk(legGeo, HM.pants, -0.1, 0.33, 0), legR = mk(legGeo, HM.pants, 0.1, 0.33, 0);
  const shoeGeo = new T.BoxGeometry(0.14, 0.08, 0.24);
  mk(shoeGeo, HM.shoe, -0.1, 0.05, 0.03); mk(shoeGeo, HM.shoe, 0.1, 0.05, 0.03);
  mk(new T.CylinderGeometry(0.2, 0.23, 0.52, 14), HM.shirt, 0, 0.82, 0);
  // arms swing from the shoulders
  const arm = side => {
    const g = new T.Group(); g.position.set(side * 0.27, 1.03, 0); body.add(g);
    mk(new T.CylinderGeometry(0.065, 0.06, 0.42, 8), HM.shirt, 0, -0.2, 0, g);
    const hand = new T.Group(); hand.position.y = -0.44; g.add(hand);
    mk(new T.SphereGeometry(0.065, 10, 8), HM.skin, 0, 0, 0, hand);
    return { g, hand };
  };
  const armL = arm(-1), armR = arm(1);
  // head: black hair with a fringe, like the photo
  const head = new T.Group(); head.position.y = 1.36; body.add(head);
  mk(new T.SphereGeometry(0.28, 20, 16), HM.skin, 0, 0, 0, head);
  // hair: a cap that stops above the eyes, longer at the back, and a fringe on the forehead
  mk(new T.SphereGeometry(0.3, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), HM.hair, 0, 0.03, -0.015, head);
  mk(new T.SphereGeometry(0.3, 16, 12, Math.PI, Math.PI, 0, Math.PI * 0.64), HM.hair, 0, 0.03, -0.02, head);
  const fringe = mk(new T.BoxGeometry(0.44, 0.08, 0.1), HM.hair, 0, 0.19, 0.2, head); fringe.rotation.x = 0.65;
  const eyeGeo = new T.SphereGeometry(0.034, 8, 6);
  mk(eyeGeo, HM.eye, -0.095, -0.01, 0.255, head); mk(eyeGeo, HM.eye, 0.095, -0.01, 0.255, head);

  // gear, switched on per level
  const two = { side: T.DoubleSide };
  const GEAR = {};
  GEAR.backpack = mk(new T.BoxGeometry(0.34, 0.4, 0.16), cl('#b8322a'), 0, 0.86, -0.25);
  GEAR.jacket = mk(new T.CylinderGeometry(0.228, 0.258, 0.5, 14, 1, true), cl('#7a1f2b', two), 0, 0.83, 0);
  GEAR.vest = mk(new T.CylinderGeometry(0.236, 0.262, 0.38, 14, 1, true), cl('#6b4a2e', two), 0, 0.9, 0);
  GEAR.cloak = mk(new T.ConeGeometry(0.44, 0.98, 18, 1, true, Math.PI * 0.28, Math.PI * 1.44), cl('#2f6f73', two), 0, 0.69, -0.02);
  GEAR.belt = mk(new T.TorusGeometry(0.235, 0.03, 6, 22), gold, 0, 0.6, 0); GEAR.belt.rotation.x = Math.PI / 2;
  const pauld = new T.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  GEAR.pauldL = mk(pauld, gold, -0.28, 1.06, 0); GEAR.pauldR = mk(pauld, gold, 0.28, 1.06, 0);
  GEAR.amulet = new T.Group(); GEAR.amulet.position.set(0, 0.96, 0.225); body.add(GEAR.amulet);
  const gem = new T.Mesh(new T.OctahedronGeometry(0.05, 0), cryLite); gem.scale.y = 1.4; GEAR.amulet.add(gem); GEAR.amulet.add(glowS(0x8fe3d8, 0.45, 0.9));
  GEAR.coat = mk(new T.CylinderGeometry(0.245, 0.35, 0.86, 14, 1, true), cl('#1c2440', two), 0, 0.62, 0);
  GEAR.armor = mk(new T.CylinderGeometry(0.215, 0.248, 0.5, 14), cl('#e8e0cc', { metalness: 0.65, roughness: 0.3 }), 0, 0.82, 0);
  GEAR.cape = mk(new T.PlaneGeometry(0.58, 0.98, 1, 4), cl('#8a1f2e', two), 0, 0.66, -0.26); GEAR.cape.rotation.x = 0.14;
  GEAR.circlet = new T.Group(); GEAR.circlet.position.y = 0.11; head.add(GEAR.circlet);
  const band = new T.Mesh(new T.TorusGeometry(0.295, 0.02, 6, 26), gold); band.rotation.x = Math.PI / 2 - 0.12; GEAR.circlet.add(band);
  const cgem = new T.Mesh(new T.OctahedronGeometry(0.045, 0), cryLite); cgem.position.set(0, 0.03, 0.29); GEAR.circlet.add(cgem);
  const leather = cl('#5b3a22'), cloth = cl('#c9b48a');
  const bootGeo = new T.CylinderGeometry(0.1, 0.095, 0.24, 10), bootMat = cl('#5b3a22');
  GEAR.boots = new T.Group(); body.add(GEAR.boots);
  mk(bootGeo, bootMat, -0.1, 0.16, 0.01, GEAR.boots); mk(bootGeo, bootMat, 0.1, 0.16, 0.01, GEAR.boots);
  GEAR.bedroll = mk(new T.CylinderGeometry(0.07, 0.07, 0.42, 10), cl('#6e7b58'), 0, 1.1, -0.28); GEAR.bedroll.rotation.z = Math.PI / 2;
  GEAR.pouch = mk(new T.BoxGeometry(0.12, 0.1, 0.07), leather, 0.17, 0.56, 0.17);
  GEAR.shieldWood = mk(new T.CylinderGeometry(0.22, 0.22, 0.04, 14), cl('#8a6038'), 0, 0.86, -0.27); GEAR.shieldWood.rotation.x = Math.PI / 2;
  GEAR.shield = new T.Group(); GEAR.shield.position.set(0, 0.86, -0.28); body.add(GEAR.shield);
  const sh = mk(new T.CylinderGeometry(0.25, 0.25, 0.04, 20), cl('#23466b', { metalness: 0.4, roughness: 0.4 }), 0, 0, 0, GEAR.shield); sh.rotation.x = Math.PI / 2;
  const boss = mk(new T.SphereGeometry(0.06, 10, 8), gold, 0, 0, -0.03, GEAR.shield);
  const rim = new T.Mesh(new T.TorusGeometry(0.25, 0.018, 6, 24), gold); GEAR.shield.add(rim);
  GEAR.hood = mk(new T.SphereGeometry(0.33, 16, 10, Math.PI, Math.PI, 0, Math.PI * 0.7), cl('#2f6f73', two), 0, 0.0, -0.04, head); GEAR.hood.rotation.x = -0.35; // hood down, behind the head
  GEAR.scarf = mk(new T.TorusGeometry(0.17, 0.05, 8, 18), cl('#b0452f'), 0, 1.16, 0); GEAR.scarf.rotation.x = Math.PI / 2;
  GEAR.satchel = mk(new T.BoxGeometry(0.2, 0.18, 0.08), leather, -0.24, 0.62, 0.05);
  GEAR.strap = mk(new T.TorusGeometry(0.3, 0.018, 6, 24), leather, 0, 0.84, 0); GEAR.strap.rotation.set(Math.PI / 2, 0.75, 0);
  GEAR.aura = glowS(0xffe2a8, 3.2, 0.35); GEAR.aura.position.set(0, 0.9, -0.1); body.add(GEAR.aura);
  const midnight = cl('#050507', { roughness: 0.45, metalness: 0.15, envMapIntensity: 0.25, side: T.DoubleSide }), silver = cl('#aab3bf', { metalness: 0.8, roughness: 0.3 });
  GEAR.blackCoat = new T.Group(); body.add(GEAR.blackCoat);
  mk(new T.CylinderGeometry(0.245, 0.42, 1.0, 18, 1, true, 0.2, Math.PI * 2 - 0.4), midnight, 0, 0.6, 0, GEAR.blackCoat); // open at the front
  mk(new T.CylinderGeometry(0.17, 0.2, 0.14, 16, 1, true), midnight, 0, 1.16, 0, GEAR.blackCoat);                         // high collar
  const hem = mk(new T.TorusGeometry(0.415, 0.014, 6, 36), silver, 0, 0.11, 0, GEAR.blackCoat); hem.rotation.x = Math.PI / 2;
  mk(new T.BoxGeometry(0.47, 0.06, 0.44), cl('#1b1c22'), 0, 0.58, 0, GEAR.blackCoat);                                   // dark belt
  // things held in the hands
  const held = (build, hand) => { const g = new T.Group(); build(g); hand.add(g); return g; };
  GEAR.woodSword = held(g => { mk(new T.BoxGeometry(0.05, 0.6, 0.02), cl('#9a7148'), 0, -0.3, 0.08, g); mk(new T.BoxGeometry(0.18, 0.03, 0.04), cl('#5a4332'), 0, -0.02, 0.08, g); g.rotation.x = -1.2; }, armR.hand);
  GEAR.sword = held(g => { mk(new T.BoxGeometry(0.055, 0.72, 0.018), cl('#d7dde6', { metalness: 0.9, roughness: 0.2 }), 0, -0.36, 0.08, g); mk(new T.BoxGeometry(0.2, 0.035, 0.05), gold, 0, -0.02, 0.08, g); g.rotation.x = -1.2; }, armR.hand);
  GEAR.lantern = held(g => { mk(new T.BoxGeometry(0.13, 0.17, 0.13), cl('#3a2e22'), 0, -0.16, 0.02, g); const gl = glowS(0xffc46a, 0.9, 0.95); gl.position.set(0, -0.16, 0.02); g.add(gl); mk(new T.BoxGeometry(0.08, 0.1, 0.08), new T.MeshBasicMaterial({ color: 0xffd08a }), 0, -0.16, 0.02, g); }, armL.hand);
  const blade = (hand, bladeMat, glow, side) => held(g => {
    mk(new T.BoxGeometry(0.06, 1.1, 0.018), bladeMat, 0, -0.6, 0.05, g);
    mk(new T.BoxGeometry(0.2, 0.035, 0.06), silver, 0, -0.04, 0.05, g);
    mk(new T.CylinderGeometry(0.022, 0.022, 0.14, 8), cl('#1b1c22'), 0, 0.05, 0.05, g);
    if (glow) { const gl = glowS(glow, 0.9, 0.55); gl.position.set(0, -0.55, 0.05); gl.scale.set(0.5, 1.6, 1); g.add(gl); }
    g.rotation.set(-0.35, 0, side * 0.3);
  }, hand);
  GEAR.swordBlack = blade(armR.hand, cl('#0b0b12', { metalness: 0.9, roughness: 0.2, emissive: 0x1b2a5c, emissiveIntensity: 0.9 }), 0x4a64c8, 1); // black blade, cold blue sheen
  GEAR.swordLight = blade(armL.hand, cl('#dff6f4', { metalness: 0.6, roughness: 0.2, emissive: 0x2a8a80, emissiveIntensity: 0.6 }), 0x8fe3d8, -1);
  GEAR.staff = held(g => { mk(new T.CylinderGeometry(0.025, 0.03, 1.5, 8), cl('#5a4332'), 0, 0.2, 0.05, g); const c = new T.Mesh(new T.OctahedronGeometry(0.11, 0), cryLite); c.scale.y = 1.6; c.position.set(0, 1.02, 0.05); g.add(c); const gl = glowS(0x8fe3d8, 1.1, 0.8); gl.position.copy(c.position); g.add(gl); }, armR.hand);

  // level → outfit (colours of the base clothes + which gear is worn)
  const OUTFITS = [
    { shirt: '#f4f1ea', pants: '#1f2a4a', gear: ['backpack'] },                                                                 // Lv 1  junior-high dreamer
    { shirt: '#f4f1ea', pants: '#3b5680', gear: ['backpack', 'bedroll', 'jacket', 'boots'] },                                   // Lv 4  freshman adventurer (BINUS jacket)
    { shirt: '#3a3f4a', pants: '#4a4034', gear: ['vest', 'woodSword', 'shieldWood', 'belt', 'pouch', 'boots'] },                // Lv 6  apprentice
    { shirt: '#1f4f5a', pants: '#3a2e26', gear: ['cloak', 'hood', 'belt', 'pouch', 'sword', 'shield', 'boots'] },               // Lv 10 guild builder
    { shirt: '#23335c', pants: '#3a2e26', gear: ['cloak', 'hood', 'belt', 'pouch', 'sword', 'shield', 'pauldL', 'pauldR', 'amulet', 'boots'] }, // Lv 13 relic seeker
    { shirt: '#23335c', pants: '#2a2f45', gear: ['coat', 'scarf', 'satchel', 'strap', 'belt', 'pauldL', 'pauldR', 'amulet', 'lantern', 'boots'] }, // Lv 17 road walker
    { shirt: '#e8e0cc', pants: '#2a2f45', gear: ['armor', 'cape', 'belt', 'pauldL', 'pauldR', 'amulet', 'circlet', 'staff', 'boots', 'aura'] },    // Lv 20 aspiring game master
    { shirt: '#15161c', pants: '#0f1015', boot: '#141519', gear: ['blackCoat', 'boots', 'swordBlack', 'swordLight'] }  // Lv 23 game master: the black dual-blade swordsman
  ];
  const wear = k => {
    const o = OUTFITS[k];
    HM.shirt.color.set(o.shirt); HM.pants.color.set(o.pants);
    bootMat.color.set(o.boot || '#5b3a22');
    Object.entries(GEAR).forEach(([name, obj]) => { obj.visible = o.gear.includes(name); });
  };
  // where the hero stands on each chapter's island
  const spots = [
    () => V(L0.x + 1.8, L0.y + 0.42, L0.z + 2.1),
    () => V(L1.x + 0.3, L1.y + 0.42, L1.z + 2.4),
    () => V(L2.x + 1.3, L2.y + 0.52, L2.z + 2.2),
    () => V(L3.x + 0.0, L3.y + 0.42, L3.z + 1.5),
    () => V(L4.x + 2.2, L4.y - 2.63, L4.z + 9.2),
    () => lanterns[3].g.position.clone().add(V(-0.2, 0.42, 0.35)),
    () => V(L6.x - 2.2, L6.y + 0.42, L6.z + 2.6),
    () => V(L7.x - 0.3, L7.y + 0.42, L7.z + 1.2)
  ];
  // level-up burst
  const burstN = 60, burstPos = new Float32Array(burstN * 3), burstVel = [];
  for (let i = 0; i < burstN; i++) { const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, s = Math.sqrt(1 - u * u); burstVel.push(V(Math.cos(a) * s, Math.abs(u) + 0.3, Math.sin(a) * s).multiplyScalar(1.2 + Math.random() * 1.8)); }
  const burstGeo = new T.BufferGeometry(); burstGeo.setAttribute('position', new T.BufferAttribute(burstPos, 3));
  const burstMat = new T.PointsMaterial({ size: 0.22, map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, color: 0xf1cf8e, opacity: 0 });
  const burst = new T.Points(burstGeo, burstMat); scene.add(burst);
  const heroLight = new T.PointLight(0xffe2a8, 0, 8, 1.6); scene.add(heroLight);
  const heroState = { level: -1, pop: 1, burstT: 9 };
  wear(0); hero.position.copy(spots[0]());
  function updateHero(dt, t, m) {
    const want = shared.oracle ? OUTFITS.length - 1 : Math.max(0, Math.min(OUTFITS.length - 2, shared.level || 0));
    if (want !== heroState.level) {
      const first = heroState.level < 0;
      heroState.level = want;
      wear(want);
      hero.position.copy(spots[want]());
      if (!first) { heroState.pop = 0; heroState.burstT = 0; burst.position.copy(hero.position).add(V(0, 1, 0)); heroLight.position.copy(burst.position); }
    }
    if (want === 5) hero.position.copy(spots[5]()); // the lantern islet bobs; ride along
    // pop in with a little overshoot, burst of gold light
    heroState.pop = Math.min(1, heroState.pop + dt * 2.2);
    const p = heroState.pop, pop = p < 1 ? 1 + Math.sin(p * Math.PI) * 0.35 - (1 - p) * 0.9 : 1;
    hero.scale.setScalar(HERO_SCALE * Math.max(0.01, pop));
    heroState.burstT += dt;
    const bt = heroState.burstT;
    burstMat.opacity = bt < 1.4 ? (1 - bt / 1.4) : 0;
    heroLight.intensity = bt < 1 ? (1 - bt) * 6 : 0;
    if (bt < 1.4) { for (let i = 0; i < burstN; i++) { const v = burstVel[i]; burstPos[i * 3] = v.x * bt; burstPos[i * 3 + 1] = v.y * bt - bt * bt * 0.6; burstPos[i * 3 + 2] = v.z * bt; } burstGeo.attributes.position.needsUpdate = true; }
    // idle: breathe, sway arms, glance around, turn to face the camera
    body.position.y = Math.abs(Math.sin(t * 2.2)) * 0.025 * m;
    const dual = GEAR.swordBlack.visible, lift = shared.oracle ? orbAmp * 0.9 : 0;
    armL.g.rotation.x = Math.sin(t * 1.8) * 0.12 * m - (dual ? 0.25 + lift : 0);
    armR.g.rotation.x = -Math.sin(t * 1.8) * 0.12 * m - (GEAR.staff.visible ? 0.2 : 0) - (dual ? 0.25 : 0) - lift;
    armL.g.rotation.z = dual ? -0.32 : -0.08; armR.g.rotation.z = dual ? 0.32 : 0.08;
    head.rotation.y = Math.sin(t * 0.6) * 0.25 * m;
    legL.rotation.x = legR.rotation.x = 0;
    if (GEAR.cape.visible) GEAR.cape.rotation.x = 0.14 + Math.sin(t * 1.6) * 0.06 * m;
    const yaw = Math.atan2(cam.position.x - hero.position.x, cam.position.z - hero.position.z);
    let d = yaw - hero.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    hero.rotation.y += d * Math.min(1, dt * 3);
  }

  scene.traverse(o => { const m = o.material; if (!m || !m.isMeshStandardMaterial) return; if (m === gold) m.envMapIntensity = 1.3; else if (m.isMeshPhysicalMaterial || m.transparent) m.envMapIntensity = 1.2; else if (m.envMapIntensity === 1) m.envMapIntensity = 0.3; });

  /* ---------- detail level ---------- */
  const applyDetail = () => {
    motes.geometry.setDrawRange(0, hi ? 1200 : 300);
    clouds.forEach((c, i) => { c.userData.on = hi || i % 2 === 0; });
    r.shadowMap.enabled = hi;
    r.setPixelRatio(hi ? Math.min(devicePixelRatio || 1, small ? 1.3 : 2) : 1);
  };

  /* ---------- camera path ---------- */
  let posC, lookC, shifts, yshifts;
  const MY = [0.2, 0.18, 0.12, 0.2, 0.04, 0.22, 0.2];
  function buildPath() {
    const P = [
      [V(13, 5.5, 15), V(0, 2.4, 0), -0.2, 0],
      [V(L1.x - 9, L1.y + 4.5, L1.z + 9), V(L1.x, L1.y + 1.6, L1.z), 0.2, 0],
      [V(L2.x, L2.y + 3.6, L2.z + 17.5), V(L2.x, L2.y + 4.4, L2.z - 2.5), 0, 0.1], // low angle: obelisks tower up, tops in frame
      [V(L3.x + 6, L3.y + 7, L3.z + 20), V(L3.x, L3.y + 2, L3.z - 1), -0.18, 0],
      [V(L4.x, L4.y + 0.6, L4.z + vaultR + 7.2), V(L4.x, L4.y - 0.1, L4.z), 0, 0.02],
      [V(roadMid.x + 12, roadMid.y + 7, roadMid.z - 12), V(roadMid.x - 1, roadMid.y + 0.5, roadMid.z + 1), 0, 0.22],
      [V(L6.x - 14, L6.y + 7, L6.z + 12), V(L6.x, L6.y + 6.5, L6.z), 0.2, 0]
    ];
    posC = new T.CatmullRomCurve3(P.map(p => p[0]), false, 'centripetal');
    lookC = new T.CatmullRomCurve3(P.map(p => p[1]), false, 'centripetal');
    shifts = P.map(p => p[2]); yshifts = P.map(p => p[3]);
  }
  buildPath();

  const cA = new T.Color(), cB = new T.Color();
  const mix = (a, b, key, f) => cA.set(a[key]).lerp(cB.set(b[key]), f);
  let jts = shared.jt, mx = 0, my = 0, tmx = 0, tmy = 0, envKey = null, flare = 0;
  addEventListener('mousemove', e => { tmx = e.clientX / innerWidth - 0.5; tmy = e.clientY / innerHeight - 0.5; }, { passive: true });
  const fitFov = () => { const a = cam.aspect; cam.fov = a < 1 ? Math.min(68, 2 * Math.atan(Math.tan(21 * Math.PI / 180) / Math.max(0.45, a) * 0.8) * 180 / Math.PI) : 42; cam.updateProjectionMatrix(); };
  fitFov();
  addEventListener('resize', () => { const W = host.clientWidth, H = host.clientHeight; r.setSize(W, H); cam.aspect = W / H; fitFov(); });

  const clock = new T.Clock(), tgt = new T.Vector3(), cp = new T.Vector3(), lk = new T.Vector3(), up = V(0, 1.5, 0);
  const introFrom = V(46, 34, 62), introLook = V(-4, 0, -14);
  const up1 = V(0, 1, 0), heroHead = V(), heroCam = V();
  let heroFocus = 0;
  const oracleCam = V(), oracleLook = V();
  let perfDone = false, pf = 0, pt = 0;
  const loop = () => {
    requestAnimationFrame(loop);
    const rawDt = clock.getDelta();
    // an open overlay covers the scene: keep the last frame instead of burning GPU
    if (document.documentElement.classList.contains('lock')) return;
    const m = shared.motion ? 1 : 0, dt = Math.min(rawDt, 0.05), t = clock.elapsedTime;
    // too slow in the first seconds → light mode (phones below ~33 fps, desktops below ~22 fps)
    if (!perfDone) { pf++; pt += rawDt; if (pf > 20 && t > 2.5) { perfDone = true; if (pt / pf > (small ? 0.03 : 0.045)) { hi = false; applyDetail(); } } }
    if (shared.flare) { flare = shared.flare; shared.flare = 0; }
    // frame-rate independent easing (tuned at 60fps)
    const k = (a) => 1 - Math.pow(1 - a, dt * 60);
    jts += (shared.jt - jts) * k(m ? 0.045 : 0.2);
    mx += (tmx - mx) * k(0.05); my += (tmy - my) * k(0.05);
    const last = shifts.length - 1;
    const jt = Math.max(0, Math.min(last, jts)), i0 = Math.floor(jt), fr = jt - i0, i1 = Math.min(last, i0 + 1);
    posC.getPoint(jt / last, cp); lookC.getPoint(jt / last, lk);
    cp.y += Math.sin(fr * Math.PI) * 4;
    const near3 = Math.max(0, 1 - Math.abs(jt - 3));
    const fIsle = isles[shared.isle];
    if (fIsle) lk.lerp(tgt.copy(fIsle.base).add(up), 0.55 * near3);
    // intro fly-in: start high above the whole archipelago and glide down to the Crystal Shrine
    if (shared.intro > 0) {
      shared.intro = Math.max(0, shared.intro - rawDt / (shared.introDur || 6));
      const e = shared.intro * shared.intro * (3 - 2 * shared.intro);
      cp.lerp(introFrom, e); lk.lerp(introLook, e * 0.6);
    }
    // chapter cutscene: sweep around the landmark and settle into the normal view
    let cut = 0;
    if (shared.orbit > 0) {
      shared.orbit = Math.max(0, shared.orbit - rawDt / (shared.orbitDur || 4));
      cut = shared.orbit * shared.orbit * (3 - 2 * shared.orbit);
      tgt.copy(cp).sub(lk).applyAxisAngle(up1, cut * 1.25 * (shared.orbitDir || 1));
      cp.copy(lk).add(tgt); cp.y += cut * 4;
    }
    oracleMix += ((shared.oracle ? 1 : 0) - oracleMix) * k(0.03);
    if (oracleMix > 0.002) {
      const e = oracleMix * oracleMix * (3 - 2 * oracleMix);
      // portrait phones: step back so the whole Game Master stays above the docked chat panel
      if (cam.aspect < 1) { oracleCam.set(L7.x + 1.6, L7.y + 5.2, L7.z + 13.5); oracleLook.set(L7.x + 0.5, L7.y + 1.4, L7.z + 1); }
      else { oracleCam.set(L7.x + 1.2, L7.y + 3.4, L7.z + 9.6); oracleLook.set(L7.x + 0.5, L7.y + 1.9, L7.z + 1); }
      cp.lerp(oracleCam, e); lk.lerp(oracleLook, e);
      cp.y += Math.sin(e * Math.PI) * 6; // arc up and over on the way
    }
    heroFocus += ((shared.heroFocus || 0) - heroFocus) * k(0.035);
    if (heroFocus > 0.002) {
      heroHead.copy(hero.position); heroHead.y += 1.25 * HERO_SCALE;
      // portrait phones: frame the hero fully (centred, a little higher and further back so nothing sits between)
      const tall = cam.aspect < 1;
      heroCam.copy(cp).sub(heroHead).setLength(tall ? 10.5 : 7.2).add(heroHead); heroCam.y += tall ? 2.6 : 1.1;
      cp.lerp(heroCam, heroFocus * (tall ? 0.95 : 0.8)); lk.lerp(heroHead, heroFocus * (tall ? 0.95 : 0.92));
    }
    cp.x += mx * 1.6 * m; cp.y -= my * 1.0 * m;
    cam.position.copy(cp); cam.lookAt(lk);
    cam.rotateZ(Math.max(-0.07, Math.min(0.07, -(shared.jt - jts) * 0.12)) * m);
    const W = r.domElement.clientWidth || innerWidth, H = r.domElement.clientHeight || innerHeight;
    const mob = innerWidth < 860;
    const shift = (mob ? 0 : shifts[i0] + (shifts[i1] - shifts[i0]) * fr) * (1 - cut) * (1 - heroFocus); // centred in cinematics
    const ysA = mob ? MY[i0] : yshifts[i0], ysB = mob ? MY[i1] : yshifts[i1];
    const ox = mob ? 0 : -0.17 * oracleMix, oy = mob ? 0.27 * oracleMix : 0;
    // in cinematics the hero sits in the upper half, leaving the lower third for the chapter title
    const heroUp = (cam.aspect < 1 ? 0.13 : 0.1) * heroFocus;
    cam.setViewOffset(W, H, (shift * (1 - oracleMix) + ox) * W, ((ysA + (ysB - ysA) * fr) * (1 - heroFocus) * (1 - oracleMix) + oy + heroUp) * H, W, H);

    updateHero(dt, t, m);
    updateOracleIsle(dt, t, m);

    // time of day
    const A = PAL[JOURNEY[i0]], B = PAL[JOURNEY[i1]];
    skyU.top.value.copy(mix(A, B, 'top', fr)); skyU.mid.value.copy(mix(A, B, 'mid', fr)); skyU.bot.value.copy(mix(A, B, 'bot', fr));
    scene.fog.color.copy(mix(A, B, 'fog', fr)); scene.fog.density = A.fogD + (B.fogD - A.fogD) * fr;
    sun.color.copy(mix(A, B, 'sun', fr)); sun.intensity = A.sunI + (B.sunI - A.sunI) * fr;
    hemi.color.copy(mix(A, B, 'hemiS', fr)); hemi.groundColor.copy(mix(A, B, 'hemiG', fr)); hemi.intensity = (A.hemiI + (B.hemiI - A.hemiI) * fr) * 0.75;
    starMat.opacity = A.star + (B.star - A.star) * fr;
    const ek = Math.round(jt * 2); if (ek !== envKey) { envKey = ek; updateEnv(); }
    sun.target.position.copy(lk); sun.position.copy(lk).add(tgt.set(-18, 22, 12));
    sky.position.copy(cam.position); stars.position.copy(cam.position);

    // L0
    crystal.rotation.y += dt * 0.5 * m; const cy = 3.3 + Math.sin(t * 1.2) * 0.15 * m; crystal.position.y = cy; cGlow.position.y = cryLight.position.y = cy;
    ring1.rotation.z += dt * 0.3 * m; ring2.rotation.z -= dt * 0.22 * m;
    shards.children.forEach((s, i) => { const a = s.userData.a + t * 0.6 * m; s.position.set(Math.cos(a) * 1.35, 3.3 + Math.sin(t * 1.5 + i) * 0.4 * m, Math.sin(a) * 1.35); s.rotation.y += dt * m; });
    cGlow.material.opacity = 0.45 + Math.sin(t * 2) * 0.08 * m;
    // L1
    const fl = 1 + (Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.1) * m;
    flame.scale.set(1, fl, 1); fLight.intensity = 3 * fl; fGlow.material.opacity = 0.7 * fl;
    banner.rotation.y = Math.sin(t * 1.4) * 0.25 * m;
    // L2
    const grow = jt > 1.35;
    obelisks.forEach((o, i) => {
      o.cur += ((grow ? o.h : 0.05) - o.cur) * k(0.03 + i * 0.004);
      o.body.scale.y = o.cur; o.body.position.y = o.cur / 2; o.tip.position.y = o.gl.position.y = o.cur + 0.5;
      o.tip.rotation.y += dt * 0.8 * m;
      const hl = shared.hoverSkill === i;
      o.tipMat.emissiveIntensity += ((hl ? 2.2 : 0.3) - o.tipMat.emissiveIntensity) * 0.12;
      o.gl.material.opacity += ((hl ? 0.95 : 0.3) - o.gl.material.opacity) * 0.12;
      o.gl.scale.setScalar(hl ? 3 : 1.6);
    });
    rune.rotation.z += dt * 0.15 * m; rune2.rotation.z -= dt * 0.25 * m;
    // L3
    isles.forEach((s, k) => {
      s.g.position.y = s.base.y + Math.sin(t * 0.7 + s.ph) * 0.3 * m;
      if (s.g.userData.cog) s.g.userData.cog.rotation.y += dt * 0.8 * m;
      const all = shared.isle < 0, on = all || shared.isle === k;
      s.gl.material.opacity += (((on && near3 > 0.2) ? (all ? 0.35 : 0.85) : 0) - s.gl.material.opacity) * 0.08;
    });
    // L4
    if (relics.length) {
      const target = -relics[shared.cert % relics.length].a;
      let d = target - vaultRot; d = Math.atan2(Math.sin(d), Math.cos(d));
      vaultRot += d * k(0.07); vault.rotation.y = vaultRot;
      vault.position.y = L4.y + Math.sin(t * 0.8) * 0.15 * m;
      relics.forEach(rl => { const o = Math.abs(Math.atan2(Math.sin(rl.a + vaultRot), Math.cos(rl.a + vaultRot))); rl.mat.color.setScalar(Math.max(0.1, 1 - o * 0.95)); const sc = o < 0.35 ? 1 : 0.82; rl.g.scale.x += (sc - rl.g.scale.x) * 0.1; rl.g.scale.y = rl.g.scale.z = rl.g.scale.x; });
    }
    orb.rotation.y += dt * 0.4 * m;
    // L5
    const lit = Math.max(0, Math.min(1, (jt - 4.5) / 1.0)) * lanterns.length;
    lanterns.forEach((l, i) => {
      const on = i < lit;
      l.gl.material.opacity += ((on ? 0.85 + Math.sin(t * 3 + i) * 0.1 * m : 0) - l.gl.material.opacity) * 0.08;
      l.lampMat.color.set(on ? 0xffd08a : 0x5a4a30);
      l.g.position.y = l.y + Math.sin(t * 0.8 + l.ph) * 0.2 * m;
    });
    // L6
    flare *= 0.985;
    const bp = 1 + Math.sin(t * 2.2) * 0.12 * m + flare * 2.5;
    bLight.intensity = 3 * bp; bGlow.scale.setScalar(6 * bp); beamMat.opacity = 0.1 + 0.04 * Math.sin(t * 2.2) * m + flare * 0.35; fire.rotation.y += dt * m;
    // ambient
    drift.forEach(d => { d.g.position.y = d.y + Math.sin(t * 0.6 + d.ph) * 0.35 * m; });
    // a cloud drifting right in front of the lens would white out the screen (low cameras in phone cinematics): skip it
    clouds.forEach(c => { c.position.x += dt * c.userData.s * m; if (c.position.x > 70) c.position.x = -70; c.visible = c.userData.on !== false && c.position.distanceTo(cam.position) > 13; });
    motes.position.y = Math.sin(t * 0.3) * 0.4 * m;
    const night = starMat.opacity;
    mtnMat.color.copy(skyU.mid.value).lerp(skyU.top.value, 0.35).multiplyScalar(0.8);
    hangers.forEach(h => { h.s.position.y = h.y + Math.sin(t * 0.9 + h.ph) * 0.12 * m; h.gl.position.y = h.s.position.y; h.s.rotation.y += dt * 0.4 * m; h.gl.material.opacity = 0.35 + night * 0.35; });
    runeDisc.rotation.z += dt * 0.12 * m; runeMat.opacity = 0.35 + Math.sin(t * 1.6) * 0.12 * m + night * 0.25;
    rays.forEach((rm, k) => { rm.opacity = (0.035 + Math.sin(t * 0.7 + k) * 0.012 * m) * (1 - night); });
    skyL.forEach(L => { const u = L.userData; L.position.y += dt * u.sp * m; L.position.x += Math.sin(t * 0.4 + u.ph) * dt * 0.15 * m; if (L.position.y > 26) L.position.y = -8; L.children[0].material.opacity = (0.35 + night * 0.6) * (0.85 + Math.sin(t * 3 + u.ph) * 0.15); });
    falls.forEach(fm => { fm.map.offset.y += dt * 0.9 * m; });
    birds.forEach(b => { const u = b.userData, a = u.ph + t * u.sp * m; b.position.set(u.c.x + Math.cos(a) * u.r, u.y + Math.sin(a * 2) * 0.6, u.c.z + Math.sin(a) * u.r); b.rotation.y = -a; const f = Math.sin(t * 9 + u.ph) * 0.6 * m; u.l.rotation.z = f; u.rgt.rotation.z = -f; });
    sunGlow.position.copy(cam.position).add(tgt.set(-18, 9, 12).normalize().multiplyScalar(250)); sunGlow.material.color.copy(sun.color); sunGlow.material.opacity = 0.55 * (1 - night);
    seaMat.map.offset.x += dt * 0.004 * m; seaMat2.map.offset.y += dt * 0.003 * m;
    seaMat.color.copy(skyU.bot.value).lerp(cB.set(0xffffff), 0.35); seaMat2.color.copy(seaMat.color);
    moteMat.color.set(night > 0.5 ? 0xbfe7ff : 0xf1cf8e);
    r.render(scene, cam);
    // after ~1.5 s of frames: bake what stayed still (runs once, while the splash is still up)
    if (!merged) { frameN++; if (frameN === 8) snapA = snapshot(); else if (snapA && frameN >= 8 + 40 && clock.elapsedTime > 1.5) { merged = true; try { mergeStatics(snapA); } catch (e) { console.warn('merge skipped', e); } snapA = null; } }
  };
  // Compile every shader up front, in parallel and off the main thread where the browser allows it,
  // so the first frame doesn't freeze the page (on Windows this used to take ~9s).

  /* ---------- performance: merge everything that never moves (one draw call per material) ----------
     Built from hundreds of small meshes, the world costs ~300 draw calls a frame — the main load on phones.
     Two snapshots ~1.5 s apart tell which objects stay still; those are baked together per material.
     Anything that moves, changes, or is rebuilt (hero, obelisks, vault, the Oracle's orb) is left alone. */
  const keepLive = new Set([hero, obeliskRoot, vault, orb3, shards, burst]);
  const matSig = m => [m.type, m.color && m.color.getHexString(), m.emissive && m.emissive.getHexString(), m.emissiveIntensity, m.roughness, m.metalness,
    m.map && m.map.uuid, m.flatShading, m.side, m.envMapIntensity, m.fog, m.vertexColors, m.opacity, m.transparent, m.clearcoat].join('|');
  const nodeSig = o => o.matrix.elements.map(v => v.toFixed(5)).join(',') + (o.visible ? 'v' : 'h');
  const snapshot = () => {
    const s = new Map();
    const walk = o => { if (keepLive.has(o)) return; o.updateMatrix(); s.set(o, nodeSig(o) + (o.isMesh && !Array.isArray(o.material) ? '#' + matSig(o.material) : '')); o.children.forEach(walk); };
    scene.children.forEach(walk);
    return s;
  };
  let snapA = null, frameN = 0, merged = /[?&]nomerge/.test(location.search); // ?nomerge: compare against the unmerged scene
  const mergeStatics = (A) => {
    const B = snapshot(), still = o => A.has(o) && A.get(o) === B.get(o);
    const inv = new T.Matrix4(), rel = new T.Matrix4(), buckets = new Map();
    scene.updateMatrixWorld(true);
    const why = {};
    scene.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.children.length || Array.isArray(o.material)) return;
      const r0 = !still(o) ? 'moves' : !o.visible ? 'hidden' : o.geometry.morphAttributes.position ? 'morph' : '';  // geometry groups don't matter: one material
      if (r0) { why[r0] = (why[r0] || 0) + 1; return; }
      // anchor: the highest ancestor reachable through objects that never move (often the scene itself)
      let anchor = o.parent, ok = true;
      for (let a = o.parent; a && a !== scene; a = a.parent) { if (keepLive.has(a)) { ok = false; break; } if (!still(a)) break; anchor = a.parent; }
      if (!ok || !anchor) return;
      // see-through pieces only merge inside one moving group (e.g. the blobs of a cloud), never across the world
      if (o.material.transparent && anchor === scene) { why.transparent = (why.transparent || 0) + 1; return; }
      if (o.matrixWorld.determinant() < 0) return;
      const g = o.geometry, key = anchor.uuid + '|' + matSig(o.material) + '|' + o.castShadow + o.receiveShadow + '|' + !!g.attributes.uv + !!g.attributes.normal;
      (buckets.get(key) || buckets.set(key, { anchor, list: [] }).get(key)).list.push(o);
    });
    let removed = 0, added = 0;
    buckets.forEach(({ anchor, list }) => {
      if (list.length < 2) return;
      inv.copy(anchor.matrixWorld).invert();
      const parts = list.map(o => { const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()); g.applyMatrix4(rel.multiplyMatrices(inv, o.matrixWorld)); return g; });
      const names = ['position', 'normal', 'uv'].filter(n => parts[0].attributes[n]);
      const out = new T.BufferGeometry();
      names.forEach(n => {
        const size = parts[0].attributes[n].itemSize, total = parts.reduce((s, g) => s + g.attributes[n].count, 0), arr = new Float32Array(total * size);
        let off = 0; parts.forEach(g => { arr.set(g.attributes[n].array, off); off += g.attributes[n].array.length; });
        out.setAttribute(n, new T.BufferAttribute(arr, size));
      });
      parts.forEach(g => g.dispose());
      out.computeBoundingSphere(); out.computeBoundingBox();
      const m = new T.Mesh(out, list[0].material);
      m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow; m.matrixAutoUpdate = false;
      anchor.add(m); added++;
      list.forEach(o => { o.parent.remove(o); removed++; });
    });
    if (/[?&]debug3d/.test(location.search)) console.log(`[world] merged ${removed} static meshes into ${added}; skipped: ${JSON.stringify(why)}; singles: ${[...buckets.values()].filter(b => b.list.length < 2).length}`);
  };

  const warm = async () => {
    const A = PAL[JOURNEY[0]];
    skyU.top.value.set(A.top); skyU.mid.value.set(A.mid); skyU.bot.value.set(A.bot);
    envKey = Math.round(Math.max(0, shared.jt) * 2);
    updateEnv(); // shaders differ with/without an environment map: set it before compiling
    // never wait forever on a slow or stalled driver: after a few seconds, just start (shaders compile on first render)
    try { await Promise.race([r.compileAsync(scene, cam), new Promise(res => setTimeout(res, 5000))]); } catch (e) { /* compiled on first render instead */ }
    loop();
  };

  return { buildVault, buildObelisks, warm };
}
