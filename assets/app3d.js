// SoleVibe 3D story. One pair of shoes travels through the service while you scroll:
// 0 hero (dirty) → 1 picked up in a box → 2 inspected & photographed → 3 brushed clean
// → 4 whitening → 5 shoe care & QC → 6 boxed and delivered.
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

const canvas = document.getElementById('scene');
const story = document.getElementById('cerita');
const stage = document.getElementById('stage');
const panels = [...document.querySelectorAll('.panel')];
const hotspots = [...document.querySelectorAll('.hotspot')];
const STEPS = panels.length - 1;               // 6
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
} catch (e) { canvas.remove(); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

// lights
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a2766, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(4, 8, 6); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -5; key.shadow.camera.right = 5; key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
key.shadow.radius = 6; key.shadow.bias = -0.0005;
scene.add(key);
const rim = new THREE.PointLight(0x3dd9f0, 25, 20); rim.position.set(-4, 3, -4); scene.add(rim);
const flash = new THREE.PointLight(0xffffff, 0, 30); flash.position.set(2, 4, 6); scene.add(flash);

// world root for everything that belongs to the story
const world = new THREE.Group(); scene.add(world);

// floor that only catches the shadow
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.28 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; world.add(floor);

// ---------- shoe ----------
const shoePivot = new THREE.Group(); world.add(shoePivot);
const uMud = { value: 1 }, uYellow = { value: 1 };
let shoeReady = false;
new GLTFLoader().load('assets/model/sepatu.glb', gltf => {
  const o = gltf.scene;
  const box = new THREE.Box3().setFromObject(o);
  const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const sc = 4 / size.x;
  o.scale.setScalar(sc);
  o.position.set(-ctr.x * sc, -box.min.y * sc + 0.02, -ctr.z * sc);
  o.traverse(m => {
    if (!m.isMesh) return;
    m.castShadow = true;
    m.material.envMapIntensity = 1.0;
    m.material.onBeforeCompile = sh => {
      sh.uniforms.uMud = uMud; sh.uniforms.uYellow = uYellow;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uMud; uniform float uYellow;
          float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
          float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
            return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
          float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*vn(p); p*=2.03; a*=.5; } return s; }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          #ifdef USE_MAP
            float lum = dot(diffuseColor.rgb, vec3(.299,.587,.114));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * vec3(.92,.84,.66), uYellow * .55);
            float n = fbm(vMapUv * 8.0);
            float spots = smoothstep(.55, .66, fbm(vMapUv * 30.0 + 3.1));
            float m = clamp(smoothstep(.58, .80, n) * .45 + spots * .8, 0., 1.) * uMud;
            vec3 mudCol = mix(vec3(.28,.20,.12), vec3(.45,.35,.22), vn(vMapUv*70.));
            diffuseColor.rgb = mix(diffuseColor.rgb, mudCol, m);
          #endif`);
    };
    m.material.needsUpdate = true;
  });
  shoePivot.add(o);
  shoeReady = true;
  document.documentElement.classList.add('shoe-ready');
});

// ---------- shipping box (kraft, with the SoleVibe sticker) ----------
const kraft = new THREE.MeshStandardMaterial({ color: 0xc7a273, roughness: 0.92 });
const kraftIn = new THREE.MeshStandardMaterial({ color: 0x9c7a4f, roughness: 0.95 });
const boxG = new THREE.Group(); world.add(boxG);
const BW = 5.0, BD = 2.5, BH = 1.35, T = 0.06;
function wall(w, h, d, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [kraft, kraft, kraft, kraft, kraft, kraftIn]); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; boxG.add(m); return m; }
wall(BW, T, BD, 0, T / 2, 0);
wall(BW, BH, T, 0, BH / 2, BD / 2);
wall(BW, BH, T, 0, BH / 2, -BD / 2);
wall(T, BH, BD, BW / 2, BH / 2, 0);
wall(T, BH, BD, -BW / 2, BH / 2, 0);
const lidHinge = new THREE.Group(); lidHinge.position.set(0, BH, -BD / 2); boxG.add(lidHinge);
const lid = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.08, T, BD + 0.06), kraft); lid.position.set(0, 0, BD / 2); lid.castShadow = true; lidHinge.add(lid);
new THREE.TextureLoader().load('assets/logo-bulat.png', tex => {
  tex.colorSpace = THREE.SRGBColorSpace;
  const mk = () => new THREE.Mesh(new THREE.CircleGeometry(0.5, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
  const front = mk(); front.position.set(0, BH / 2, BD / 2 + T / 2 + 0.005); boxG.add(front);
  const top = mk(); top.rotation.x = -Math.PI / 2; top.position.set(0, T / 2 + 0.005, BD / 2); lidHinge.add(top);
});

// ---------- scanner ring (inspection) ----------
const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.022, 12, 96), new THREE.MeshBasicMaterial({ color: 0x3dd9f0, transparent: true }));
ring.rotation.y = Math.PI / 2; world.add(ring);
const ringLight = new THREE.PointLight(0x3dd9f0, 0, 4); world.add(ringLight);

// ---------- brush ----------
const brush = new THREE.Group(); world.add(brush);
{
  const wood = new THREE.MeshStandardMaterial({ color: 0x1c2a5a, roughness: 0.4, metalness: 0.1 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 0.42), wood); head.position.y = 0.2; brush.add(head);
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.9, 6, 12), wood); handle.rotation.z = Math.PI / 2; handle.position.set(-0.95, 0.32, 0); handle.rotation.y = 0; brush.add(handle);
  const bristleMat = new THREE.MeshStandardMaterial({ color: 0xf2f6ff, roughness: 0.6 });
  const bristles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 5), bristleMat, 120);
  const m = new THREE.Matrix4(); let i = 0;
  for (let x = 0; x < 15; x++) for (let z = 0; z < 8; z++) { m.makeTranslation(-0.44 + x * 0.063, 0.03, -0.17 + z * 0.048); bristles.setMatrixAt(i++, m); }
  brush.add(bristles);
  brush.traverse(o => { if (o.isMesh) o.castShadow = true; });
}

// ---------- bubbles: foam near the brush + slow ambient bubbles ----------
const bubbleMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { t: { value: 0 }, a: { value: 1 } },
  vertexShader: `varying vec3 vN; varying vec3 vV;
    void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `uniform float t; uniform float a; varying vec3 vN; varying vec3 vV;
    void main(){ float f = pow(1. - max(dot(vN,vV),0.), 2.2);
      vec3 c = mix(vec3(.55,.92,1.), vec3(.75,.75,1.), .5 + .5*sin(t*.6 + vN.y*3.));
      float spec = pow(max(dot(reflect(-vV,vN), normalize(vec3(-.5,.7,.6))),0.), 40.);
      gl_FragColor = vec4(c*f + vec3(spec), (f*.7 + spec) * a); }`
});
const bubbleGeo = new THREE.SphereGeometry(1, 24, 24);
const foam = [];
for (let i = 0; i < 40; i++) {
  const m = new THREE.Mesh(bubbleGeo, bubbleMat);
  m.userData = { ox: (Math.random() - 0.5) * 1.6, oy: Math.random() * 0.8, oz: (Math.random() - 0.5) * 1.2, s: 0.04 + Math.random() * 0.12, ph: Math.random() * 6 };
  world.add(m); foam.push(m);
}
const ambient = [];
const ambMat = bubbleMat.clone(); ambMat.uniforms = { t: bubbleMat.uniforms.t, a: { value: 0.55 } };
for (let i = 0; i < (innerWidth < 700 ? 10 : 18); i++) {
  const m = new THREE.Mesh(bubbleGeo, ambMat);
  m.scale.setScalar(0.05 + Math.random() * 0.16);
  m.position.set((Math.random() - 0.5) * 14, Math.random() * 8 - 1, -4 - Math.random() * 5);
  m.userData = { v: 0.1 + Math.random() * 0.25, w: Math.random() * 6 };
  scene.add(m); ambient.push(m);
}

// ---------- sparkles (QC) ----------
const spCanvas = document.createElement('canvas'); spCanvas.width = spCanvas.height = 64;
{ const c = spCanvas.getContext('2d'); const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(160,240,255,.8)'); g.addColorStop(1, 'rgba(160,240,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(31, 4, 2, 56); c.fillRect(4, 31, 56, 2); }
const spPos = new Float32Array(60 * 3);
for (let i = 0; i < 60; i++) { spPos[i * 3] = (Math.random() - 0.5) * 4.6; spPos[i * 3 + 1] = Math.random() * 2.2; spPos[i * 3 + 2] = (Math.random() - 0.5) * 2.2; }
const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
const sparkles = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 0.28, map: new THREE.CanvasTexture(spCanvas), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
world.add(sparkles);

// ---------- camera keyframes per step (orbit around the shoe) ----------
const CAM = [
  { az: 0.85, el: 0.22, d: 10.5, ty: 0.9 },   // 0 hero, three-quarter view
  { az: 0.45, el: 0.60, d: 15.0, ty: 0.4 },   // 1 from above into the box
  { az: 1.15, el: 0.12, d: 9.5,  ty: 0.9 },   // 2 side view, scanning
  { az: 0.70, el: 0.48, d: 8.0,  ty: 1.0 },   // 3 close, brushing the upper
  { az: -0.55, el: 0.06, d: 8.4, ty: 0.6 },   // 4 low, the sole whitening
  { az: 2.35, el: 0.24, d: 9.5,  ty: 0.9 },   // 5 back three-quarter, QC
  { az: 0.60, el: 0.55, d: 15.0, ty: 0.4 }    // 6 boxed for delivery
];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => Math.min(1, Math.max(0, v));
const ss = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const bell = (x, a, b, w = 0.3) => ss(a - w, a + w, x) * (1 - ss(b - w, b + w, x));

// ---------- layout, input ----------
let W = 0, H = 0, mobile = false;
function resize() {
  W = innerWidth; H = innerHeight; mobile = W < 700;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.fov = mobile ? 44 : 32;
  // keep the shoe beside the text: shift the frame right on desktop, up on phones
  if (mobile) camera.setViewOffset(W, H, 0, H * 0.25, W, H); else camera.setViewOffset(W, H, -W * 0.2, 0, W, H);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

let userYaw = 0, yawVel = 0, dragging = false, lastX = 0, dragged = false;
stage.addEventListener('pointerdown', e => { if (e.target.closest('a,button')) return; dragging = true; lastX = e.clientX; });
addEventListener('pointermove', e => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; yawVel = dx * 0.01; userYaw += yawVel; if (!dragged) { dragged = true; document.getElementById('drag').style.opacity = 0; } });
addEventListener('pointerup', () => { dragging = false; });
stage.style.touchAction = 'pan-y';

// step dots
const prog = document.getElementById('progress');
const dots = panels.map((_, i) => { const b = document.createElement('button'); b.setAttribute('aria-label', 'Langkah ' + i); b.onclick = () => scrollTo({ top: story.offsetTop + i * innerHeight, behavior: 'smooth' }); prog.append(b); return b; });

function storyProgress() {
  const span = story.offsetHeight - innerHeight;
  const raw = (scrollY - story.offsetTop) / innerHeight;          // steps scrolled
  const p = Math.min(STEPS, Math.max(0, raw));
  const after = (scrollY - (story.offsetTop + span)) / innerHeight; // >0 once the story is over
  return { p, after };
}

// ---------- loop ----------
const clock = new THREE.Clock();
const cur = { p: 0 };
let active = -1;
const hsLocal = [new THREE.Vector3(0.6, 1.05, 0.62), new THREE.Vector3(-0.9, 0.75, 0.66), new THREE.Vector3(1.2, 0.14, 0.62)];
const v3 = new THREE.Vector3();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  const { p, after } = storyProgress();
  const k = 1 - Math.pow(0.0015, dt);
  cur.p += (p - cur.p) * (reduce ? 1 : k);
  const P = cur.p;

  // text panels + dots
  const idx = Math.min(STEPS, Math.max(0, Math.round(p - 0.08)));
  if (idx !== active) { active = idx; panels.forEach((el, i) => el.classList.toggle('on', i === idx)); dots.forEach((d, i) => d.classList.toggle('on', i === idx)); }
  document.getElementById('hint').style.opacity = p > 0.15 ? 0 : 1;

  // camera along the keyframes
  const i0 = Math.min(STEPS - 1, Math.floor(P)), f = ss(0, 1, P - i0);
  const A = CAM[i0], B = CAM[Math.min(STEPS, i0 + 1)];
  const az = lerp(A.az, B.az, f), el = lerp(A.el, B.el, f), d = lerp(A.d, B.d, f) * (mobile ? 1.4 : 1), ty = lerp(A.ty, B.ty, f);
  camera.position.set(Math.cos(az) * Math.cos(el) * d, ty + Math.sin(el) * d, Math.sin(az) * Math.cos(el) * d);
  camera.lookAt(0, ty, 0);

  // when the story is over, the whole set scrolls up and away
  const out = ss(0.35, 1.25, after);
  world.position.y = out * 9;
  world.visible = out < 0.99;

  // shoe: user drag + gentle sway (no endless spinning)
  if (!dragging) { yawVel *= 0.92; userYaw += yawVel; }
  shoePivot.rotation.y = userYaw + (reduce ? 0 : Math.sin(t * 0.5) * 0.08);
  shoePivot.position.y = reduce ? 0 : Math.sin(t * 1.1) * 0.03;

  // dirt → clean → white
  uMud.value = 1 - 0.7 * ss(2.55, 3.55, P) - 0.3 * ss(3.5, 4.4, P);
  uYellow.value = 1 - ss(3.6, 4.5, P);

  // box: rises around the shoe for pickup (step 1), comes back for delivery (step 6)
  const boxIn = Math.max(ss(0.35, 0.95, P) * (1 - ss(1.25, 1.85, P)), ss(5.25, 5.85, P));
  boxG.position.y = -7 * (1 - boxIn);
  boxG.visible = boxIn > 0.05;
  lidHinge.rotation.x = -2.0 * (1 - ss(0.0, 0.35, after));

  // scanner (step 2)
  const scan = bell(P, 1.75, 2.45, 0.2);
  ring.visible = scan > 0.01; ring.material.opacity = scan;
  ring.position.set(-2.3 + ((t * 0.55) % 1) * 4.6, 1.0, 0);
  ringLight.position.copy(ring.position); ringLight.intensity = 6 * scan;
  flash.intensity = scan * Math.pow(Math.max(0, Math.sin(t * 2.6)), 40) * 60;

  // brush (step 3)
  const br = bell(P, 2.7, 3.45, 0.25);
  brush.visible = br > 0.01;
  const bx = Math.sin(t * 2.2) * 1.2 + 0.1;
  brush.position.set(bx, 0.72 + Math.sin(t * 14) * 0.03, 1.12 + (1 - br) * 2.5);
  brush.rotation.set(Math.PI / 2 - 0.15, 0, Math.sin(t * 2.2) * 0.1);
  bubbleMat.uniforms.a.value = br;
  foam.forEach(m => { const u = m.userData; m.visible = br > 0.02; m.position.set(bx + u.ox, 0.45 + u.oy + Math.sin(t * 3 + u.ph) * 0.05, 0.95 + Math.abs(u.oz) * 0.4); m.scale.setScalar(u.s * br * (0.8 + 0.2 * Math.sin(t * 4 + u.ph))); });

  // sparkles (step 5)
  const sp = bell(P, 4.65, 5.35, 0.25);
  sparkles.material.opacity = sp * (0.6 + 0.4 * Math.sin(t * 5));
  sparkles.rotation.y = t * 0.2;

  // hotspots (step 2)
  const showHs = scan > 0.6 && shoeReady;
  hotspots.forEach((h, i) => {
    v3.copy(hsLocal[i]); shoePivot.localToWorld(v3); v3.project(camera);
    const x = (v3.x * 0.5 + 0.5) * W, y = (-v3.y * 0.5 + 0.5) * H;
    const flip = x > W * 0.62;
    h.classList.toggle('flip', flip);
    h.style.transform = flip ? `translate(calc(${x + 6}px - 100%), ${y - 6}px)` : `translate(${x - 6}px, ${y - 6}px)`;
    h.classList.toggle('on', showHs && v3.z < 1);
  });

  // ambient bubbles
  ambient.forEach(b => { if (!reduce) { b.position.y += b.userData.v * dt; b.position.x += Math.sin(t * 0.6 + b.userData.w) * 0.002; } if (b.position.y > 8) b.position.y = -2; });
  bubbleMat.uniforms.t.value = t;

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
