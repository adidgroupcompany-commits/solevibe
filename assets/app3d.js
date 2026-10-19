// SoleVibe 3D story v3. A pair of shoes travels through the whole service while you scroll:
// 0 hero (dirty) → 1 picked up (ID tag) → 2 inspected & photographed
// → 3–7 one price, five treatments: Basic, Deep, Special, Whitening, Shoe Care
// → 8 sealed in a labelled ziplock and delivered.
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { MeshSurfaceSampler } from './vendor/MeshSurfaceSampler.js';

const canvas = document.getElementById('scene');
const story = document.getElementById('cerita');
const stage = document.getElementById('stage');
const panels = [...document.querySelectorAll('.panel')];
const hotspots = [...document.querySelectorAll('.hotspot')];
const STEPS = panels.length - 1;               // 8
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const snap = location.search.includes('snap');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
} catch (e) { canvas.remove(); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a2766, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(4, 8, 6); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
key.shadow.radius = 6; key.shadow.bias = -0.0005;
scene.add(key);
const rim = new THREE.PointLight(0x3dd9f0, 25, 20); rim.position.set(-4, 3, -4); scene.add(rim);
const flash = new THREE.PointLight(0xffffff, 0, 30); flash.position.set(2, 4, 6); scene.add(flash);

const world = new THREE.Group(); scene.add(world);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.28 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; world.add(floor);

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => Math.min(1, Math.max(0, v));
const ss = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const bell = (x, a, b, w = 0.3) => ss(a - w, a + w, x) * (1 - ss(b - w, b + w, x));
const rnd = (a, b) => a + Math.random() * (b - a);

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const logoImg = new Image(); logoImg.src = 'assets/logo-bulat.png';

// ---------- the pair ----------
const pair = new THREE.Group(); world.add(pair);
const shoeR = new THREE.Group(); shoeR.position.set(0.15, 0, 0.88); shoeR.rotation.y = -0.05; pair.add(shoeR);
const shoeL = new THREE.Group(); shoeL.position.set(-0.3, 0, -0.88); shoeL.rotation.y = 0.07; shoeL.scale.z = -1; pair.add(shoeL);
const U = { uMud: { value: 1 }, uDust: { value: 1 }, uSweep: { value: -10 } };
const shoeMats = [];
let shoeReady = false, nearMesh = null;
const samples = [];   // surface points (world-local) + normals, for dust, sparkles and mist

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
    const mat = m.material; shoeMats.push(mat);
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSvW;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vSvW;
          uniform float uMud; uniform float uDust; uniform float uSweep;
          float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
          float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
            return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
          float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*vn(p); p*=2.03; a*=.5; } return s; }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          #ifdef USE_MAP
            float lum = dot(diffuseColor.rgb, vec3(.299,.587,.114));
            float yel = smoothstep(uSweep - .35, uSweep + .35, vSvW.x);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * vec3(.92,.83,.64), yel * .55);
            float dn = fbm(vMapUv * 5.0 + 1.7);
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(.74,.70,.64), uDust * (.45 + .55 * dn));
            float n = fbm(vMapUv * 8.0);
            float spots = smoothstep(.55, .66, fbm(vMapUv * 30.0 + 3.1));
            float m = clamp(smoothstep(.58, .80, n) * .45 + spots * .8, 0., 1.) * uMud;
            vec3 mudCol = mix(vec3(.28,.20,.12), vec3(.45,.35,.22), vn(vMapUv*70.));
            diffuseColor.rgb = mix(diffuseColor.rgb, mudCol, m);
          #endif`);
    };
    mat.needsUpdate = true;
  });
  shoeR.add(o);
  shoeL.add(o.clone());
  world.updateMatrixWorld(true);
  const inv = world.matrixWorld.clone().invert();
  [shoeR, shoeL].forEach((s, si) => s.traverse(m => {
    if (!m.isMesh) return;
    if (si === 0) nearMesh = m;
    const sampler = new MeshSurfaceSampler(m).build();
    const rel = inv.clone().multiply(m.matrixWorld), nm = new THREE.Matrix3().getNormalMatrix(rel);
    const p = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < 260; i++) { sampler.sample(p, n); samples.push({ p: p.clone().applyMatrix4(rel), n: n.clone().applyMatrix3(nm).normalize() }); }
  }));
  placeSparkles();
  shoeReady = true;
  document.documentElement.classList.add('shoe-ready');
});

// ---------- particles (dust, mist, sparkles) ----------
const softTex = canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.4, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
const starTex = canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 20); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(160,240,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.moveTo(32, 2); c.lineTo(34, 30); c.lineTo(62, 32); c.lineTo(34, 34); c.lineTo(32, 62); c.lineTo(30, 34); c.lineTo(2, 32); c.lineTo(30, 30); c.fill(); });
function makeParticles(n, tex, color, additive) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), al = new Float32Array(n), sz = new Float32Array(n);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(al, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { map: { value: tex }, color: { value: new THREE.Color(color) }, uScale: { value: 400 } },
    vertexShader: `attribute float aAlpha; attribute float aSize; varying float vA; uniform float uScale;
      void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 color; varying float vA;
      void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(color * t.rgb, t.a * vA); }`
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; world.add(pts);
  return { pts, geo, pos, al, sz, mat, vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n), n, next: 0 };
}
const dust = makeParticles(320, softTex, 0x9b8a70, false);
const mist = makeParticles(260, softTex, 0xdff8ff, true);
const spark = makeParticles(80, starTex, 0xffffff, true);
const sparkPh = new Float32Array(80);
function placeSparkles() {
  for (let i = 0; i < spark.n; i++) { const s = samples[(Math.random() * samples.length) | 0]; spark.pos.set([s.p.x + s.n.x * 0.03, s.p.y + s.n.y * 0.03, s.p.z + s.n.z * 0.03], i * 3); spark.sz[i] = rnd(0.18, 0.4); sparkPh[i] = Math.random() * 6.28; }
  spark.geo.attributes.position.needsUpdate = true; spark.geo.attributes.aSize.needsUpdate = true;
}
function emit(P, x, y, z, vx, vy, vz, life, size) {
  const i = P.next; P.next = (P.next + 1) % P.n;
  P.pos.set([x, y, z], i * 3); P.vel.set([vx, vy, vz], i * 3); P.life[i] = P.max[i] = life; P.sz[i] = size;
}
function stepParticles(P, dt, alphaMax, drag, grow) {
  for (let i = 0; i < P.n; i++) {
    if (P.life[i] <= 0) { P.al[i] = 0; continue; }
    P.life[i] -= dt;
    const k = i * 3;
    P.pos[k] += P.vel[k] * dt; P.pos[k + 1] += P.vel[k + 1] * dt; P.pos[k + 2] += P.vel[k + 2] * dt;
    P.vel[k] *= drag; P.vel[k + 1] *= drag; P.vel[k + 2] *= drag;
    const f = P.life[i] / P.max[i];
    P.al[i] = alphaMax * Math.min(1, (1 - f) * 6) * f;
    P.sz[i] *= grow;
  }
  P.geo.attributes.position.needsUpdate = true; P.geo.attributes.aAlpha.needsUpdate = true; P.geo.attributes.aSize.needsUpdate = true;
}

// ---------- foam bubbles (stick where the brush has been) ----------
const bubbleMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { t: { value: 0 } },
  vertexShader: `varying vec3 vN; varying vec3 vV;
    void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `uniform float t; varying vec3 vN; varying vec3 vV;
    void main(){ float f = pow(1. - max(dot(vN,vV),0.), 1.6);
      vec3 c = mix(vec3(.93,.97,1.), vec3(.75,.9,1.), .5 + .5*sin(t*.6 + vN.y*3.));
      float spec = pow(max(dot(reflect(-vV,vN), normalize(vec3(-.5,.7,.6))),0.), 30.);
      gl_FragColor = vec4(c + vec3(spec), clamp(.18 + f*.75 + spec, 0., 1.)); }`
});
const bubbleGeo = new THREE.SphereGeometry(1, 16, 12);
const foam = [];
for (let i = 0; i < 90; i++) { const m = new THREE.Mesh(bubbleGeo, bubbleMat); m.visible = false; m.userData = { life: 0, max: 1, s: 0.05 }; world.add(m); foam.push(m); }
let foamNext = 0;
function spawnFoam(p, n) {
  const m = foam[foamNext]; foamNext = (foamNext + 1) % foam.length;
  m.position.set(p.x + n.x * 0.03 + rnd(-0.12, 0.12), p.y + n.y * 0.03 + rnd(-0.06, 0.08), p.z + n.z * 0.03 + rnd(-0.08, 0.08));
  m.userData.life = m.userData.max = rnd(2.2, 3.6); m.userData.s = rnd(0.025, 0.075); m.visible = true;
}

// ---------- shoe brush: oval wooden palm brush, ~900 natural bristles that bend with the stroke ----------
const brush = new THREE.Group(); world.add(brush); brush.visible = false;
const uBend = { value: new THREE.Vector2() };
{
  const wood = canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = '#b57a44'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      c.strokeStyle = `rgba(${70 + Math.random() * 30},${35 + Math.random() * 20},12,${0.12 + Math.random() * 0.22})`; c.lineWidth = 0.6 + Math.random() * 2.4;
      c.beginPath(); const y0 = Math.random() * h, a = 2 + Math.random() * 6, f = 0.01 + Math.random() * 0.02;
      for (let x = 0; x <= w; x += 8) c.lineTo(x, y0 + Math.sin(x * f + i) * a + Math.sin(x * 0.003 + i * 2) * 10);
      c.stroke();
    }
  });
  const shape = new THREE.Shape(); shape.absellipse(0, 0, 0.62, 0.27, 0, Math.PI * 2);
  const hg = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4, curveSegments: 48 });
  hg.rotateX(-Math.PI / 2); hg.translate(0, 0.05, 0);
  const head = new THREE.Mesh(hg, new THREE.MeshStandardMaterial({ map: wood, roughness: 0.5, metalness: 0 }));
  head.castShadow = true; brush.add(head);
  const sticker = new THREE.Mesh(new THREE.CircleGeometry(0.15, 40), new THREE.MeshStandardMaterial({ roughness: 0.4 }));
  sticker.rotation.x = -Math.PI / 2; sticker.position.y = 0.245; brush.add(sticker);
  logoImg.decode().then(() => { const t = new THREE.Texture(logoImg); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; sticker.material.map = t; sticker.material.needsUpdate = true; }).catch(() => {});

  const N = 900;
  const bg = new THREE.CylinderGeometry(0.0042, 0.0065, 1, 4, 3); bg.translate(0, -0.5, 0);
  const bm = new THREE.MeshStandardMaterial({ roughness: 0.75 });
  bm.onBeforeCompile = sh => {
    sh.uniforms.uBend = uBend;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec2 uBend;')
      .replace('#include <project_vertex>', `vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        float dd = clamp(-mvPosition.y / 0.3, 0., 1.);
        mvPosition.xz += uBend * dd * dd;
        mvPosition.y += length(uBend) * dd * dd * .35;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  const bristles = new THREE.InstancedMesh(bg, bm, N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    let x, z; do { x = rnd(-1, 1); z = rnd(-1, 1); } while (x * x + z * z > 1);
    p.set(x * 0.56, 0.02, z * 0.22);
    e.set(rnd(-0.07, 0.07) + z * 0.12, 0, rnd(-0.07, 0.07) - x * 0.06); q.setFromEuler(e);
    s.set(1, rnd(0.25, 0.31), 1);
    m4.compose(p, q, s); bristles.setMatrixAt(i, m4);
    col.setHSL(0.1 + rnd(-0.01, 0.015), rnd(0.25, 0.45), rnd(0.62, 0.86)); bristles.setColorAt(i, col);
  }
  brush.add(bristles);
}

// ---------- ID tag hung on the heel loop at pickup ----------
const tag = new THREE.Group(); shoeR.add(tag); tag.visible = false;
{
  const tex = canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = '#f7f3ea'; c.beginPath(); c.roundRect(0, 0, w, h, 28); c.fill();
    c.fillStyle = '#0a1230'; c.font = '700 54px Sora, sans-serif'; c.fillText('SoleVibe', 120, 92);
    c.fillStyle = '#3c4a7a'; c.font = '600 38px Figtree, sans-serif'; c.fillText('ID SV-0427', 120, 152); c.fillText('1 pasang · dijemput', 120, 202);
    c.fillStyle = '#0a1230'; c.beginPath(); c.arc(62, 128, 18, 0, 7); c.fill();
  });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide }));
  card.position.set(0.5, -0.32, 0); tag.add(card);
  const strG = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.02, -0.32, 0)]);
  tag.add(new THREE.Line(strG, new THREE.LineBasicMaterial({ color: 0xf4f7ff })));
  tag.position.set(-1.78, 1.86, 0.1);
}

// ---------- ziplock bag (return delivery) ----------
const BW = 5.6, BH = 3.2, BD = 4.3;
const bagG = new THREE.Group(); world.add(bagG); bagG.visible = false;
const bagGeo = new THREE.BoxGeometry(BW, BH, BD, 28, 16, 22); bagGeo.translate(0, BH / 2, 0);
const bagBase = bagGeo.attributes.position.array.slice();
const plastic = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  uniforms: { uA: { value: 1 } },
  vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW;
    void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vec4 mv = viewMatrix * w; vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uA; varying vec3 vN; varying vec3 vV; varying vec3 vW;
    void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n;
      float f = pow(1. - abs(dot(n, vV)), 2.5);
      vec3 r = reflect(-vV, n);
      float s = pow(max(dot(r, normalize(vec3(.45,.75,.5))), 0.), 70.) + .55 * pow(max(dot(r, normalize(vec3(-.6,.45,.4))), 0.), 24.);
      float streak = smoothstep(.9, 1., sin(vW.x * 1.7 + vW.y * 2.3) * .5 + .5) * .25;
      float a = (.04 + .5 * f + s + streak * f) * uA;
      gl_FragColor = vec4(mix(vec3(.82,.92,1.), vec3(1.), clamp(s,0.,1.)), clamp(a, 0., .9)); }`
});
const hidden = new THREE.MeshBasicMaterial({ visible: false });
const bag = new THREE.Mesh(bagGeo, [plastic, plastic, hidden, plastic, plastic, plastic]); bag.renderOrder = 5; bagG.add(bag);
let lastPinch = -1;
function shapeBag(pinch) {
  if (Math.abs(pinch - lastPinch) < 0.002) return; lastPinch = pinch;
  const a = bagGeo.attributes.position.array;
  for (let i = 0; i < a.length; i += 3) {
    let x = bagBase[i], y = bagBase[i + 1], z = bagBase[i + 2];
    const u = x / (BW / 2), v = y / BH, w = z / (BD / 2);
    x *= 1 - 0.035 * w * w;
    z *= (1 - 0.09 * u * u * u * u) * (1 + 0.05 * Math.sin(Math.PI * v));
    const nz = Math.sin(x * 2.9 + y * 1.9) * Math.sin(z * 2.1 - y * 3.1) * 0.04 + Math.sin(x * 7.1 + y * 5.3) * 0.012;
    x += nz * u * 0.6; z += nz * w;
    const pk = pinch * Math.pow(Math.max(0, (v - 0.55) / 0.45), 1.25);
    z *= 1 - pk;
    y -= pk * 0.12 * (1 - u * u);
    a[i] = x; a[i + 1] = y; a[i + 2] = z;
  }
  bagGeo.attributes.position.needsUpdate = true; bagGeo.computeVertexNormals();
}
shapeBag(0);
const seam = new THREE.Group(); bagG.add(seam); seam.position.y = BH - 0.02;
seam.add(new THREE.Mesh(new THREE.BoxGeometry(BW * 0.985, 0.26, 0.05), new THREE.MeshPhysicalMaterial({ color: 0xeef4ff, transparent: true, opacity: 0.55, roughness: 0.25, clearcoat: 1 })));
const zipA = new THREE.Mesh(new THREE.BoxGeometry(BW * 0.985, 0.035, 0.07), new THREE.MeshStandardMaterial({ color: 0x3dd9f0, roughness: 0.35 })); zipA.position.y = -0.05; seam.add(zipA);
const zipB = new THREE.Mesh(new THREE.BoxGeometry(BW * 0.985, 0.035, 0.07), new THREE.MeshStandardMaterial({ color: 0x1a2766, roughness: 0.35 })); zipB.position.y = -0.1; seam.add(zipB);
const slider = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.16), new THREE.MeshStandardMaterial({ color: 0x0a1230, roughness: 0.3, metalness: 0.2 })); slider.position.y = -0.07; seam.add(slider);
const label = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.0), new THREE.MeshStandardMaterial({ roughness: 0.7, transparent: true }));
label.position.set(0.9, 1.0, BD / 2 + 0.07); bagG.add(label);
logoImg.decode().then(() => {
  label.material.map = canvasTex(760, 400, (c, w, h) => {
    c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(0, 0, w, h, 36); c.fill();
    c.drawImage(logoImg, 34, 70, 170, 170);
    c.fillStyle = '#0a1230'; c.font = '800 66px Sora, sans-serif'; c.fillText('SoleVibe', 236, 140);
    c.fillStyle = '#3c4a7a'; c.font = '600 40px Figtree, sans-serif'; c.fillText('ID SV-0427 · 1 pasang', 236, 200);
    c.fillStyle = '#0f9fb5'; c.font = '700 40px Figtree, sans-serif'; c.fillText('✓ Selesai · lolos QC', 236, 252);
    c.fillStyle = '#e9eefc'; c.fillRect(34, 300, w - 68, 4);
    c.fillStyle = '#5b6894'; c.font = '600 32px Figtree, sans-serif'; c.fillText('Restore Your Sole. Refresh Your Vibe.', 34, 356);
  });
  label.material.needsUpdate = true;
}).catch(() => {});

// ---------- inspection scanner ----------
const ringG = new THREE.Group(); world.add(ringG); ringG.rotation.y = Math.PI / 2;
const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.02, 10, 120), new THREE.MeshBasicMaterial({ color: 0x3dd9f0, transparent: true }));
ring.scale.set(2.45 / 1.45, 1.35 / 1.45, 1); ringG.add(ring);
const ringLight = new THREE.PointLight(0x3dd9f0, 0, 5); world.add(ringLight);

// ---------- whitening light curtain ----------
const curtain = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.5), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { a: { value: 0 } },
  vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: 'uniform float a; varying vec2 vU; void main(){ float y = 1. - vU.y; float e = smoothstep(0.,.15,vU.x) * smoothstep(1.,.85,vU.x); gl_FragColor = vec4(vec3(.75,.95,1.) * e * (.35 + .65*y) * a, 1.); }'
}));
curtain.rotation.y = Math.PI / 2; curtain.position.y = 0.75; world.add(curtain);
const curtainLight = new THREE.PointLight(0xbff4ff, 0, 4); world.add(curtainLight);

// ---------- ambient bubbles in the background ----------
const ambMat = bubbleMat.clone(); ambMat.uniforms = { t: bubbleMat.uniforms.t };
ambMat.fragmentShader = ambMat.fragmentShader.replace('clamp(.18 + f*.75 + spec, 0., 1.)', 'clamp(f*.45 + spec*.6, 0., 1.)');
const ambient = [];
for (let i = 0; i < (innerWidth < 700 ? 9 : 16); i++) {
  const m = new THREE.Mesh(bubbleGeo, ambMat);
  m.scale.setScalar(rnd(0.05, 0.2));
  m.position.set(rnd(-8, 8), rnd(-1, 8), rnd(-9, -4));
  m.userData = { v: rnd(0.1, 0.35), w: Math.random() * 6 };
  scene.add(m); ambient.push(m);
}

// ---------- camera keyframes per step ----------
const CAM = [
  { az: 0.80, el: 0.24, d: 12.0, tx: 0, ty: 0.85, tz: 0 },     // 0 hero
  { az: 2.55, el: 0.28, d: 10.5, tx: -0.9, ty: 1.2, tz: 0.4 }, // 1 picked up, ID tag on the heel
  { az: 1.20, el: 0.16, d: 11.5, tx: 0, ty: 0.9, tz: 0 },      // 2 inspection
  { az: 0.95, el: 0.32, d: 11.0, tx: 0, ty: 0.8, tz: 0 },      // 3 basic cleaning
  { az: 1.05, el: 0.42, d: 7.6, tx: 0.9, ty: 0.9, tz: 0.7 },   // 4 deep cleaning (brush)
  { az: 0.35, el: 0.40, d: 7.6, tx: 1.2, ty: 0.7, tz: 0.6 },   // 5 special treatment
  { az: 1.50, el: 0.06, d: 10.5, tx: 0, ty: 0.55, tz: 0 },     // 6 whitening (low, sole)
  { az: 2.30, el: 0.30, d: 11.0, tx: 0, ty: 0.85, tz: 0 },     // 7 shoe care + QC
  { az: 0.70, el: 0.36, d: 14.5, tx: 0, ty: 1.3, tz: 0 }       // 8 ziplock, delivery
];

// ---------- layout, input ----------
let W = 0, H = 0, mobile = false;
function resize() {
  W = innerWidth; H = innerHeight; mobile = W < 700;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.fov = mobile ? 46 : 32;
  if (mobile) camera.setViewOffset(W, H, 0, H * 0.24, W, H); else camera.setViewOffset(W, H, -W * 0.2, 0, W, H);
  camera.updateProjectionMatrix();
  const sc = H * renderer.getPixelRatio() * 0.5;
  [dust, mist, spark].forEach(P => P.mat.uniforms.uScale.value = sc);
}
addEventListener('resize', resize); resize();

let userYaw = 0, yawVel = 0, dragging = false, lastX = 0, dragged = false;
stage.addEventListener('pointerdown', e => { if (e.target.closest('a,button')) return; dragging = true; lastX = e.clientX; });
addEventListener('pointermove', e => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; yawVel = dx * 0.01; userYaw += yawVel; if (!dragged) { dragged = true; const d = document.getElementById('drag'); if (d) d.style.opacity = 0; } });
addEventListener('pointerup', () => { dragging = false; });
stage.style.touchAction = 'pan-y';

const prog = document.getElementById('progress');
const dots = panels.map((_, i) => { const b = document.createElement('button'); b.setAttribute('aria-label', 'Langkah ' + (i + 1)); b.onclick = () => scrollTo({ top: story.offsetTop + i * stepPx(), behavior: 'smooth' }); prog.append(b); return b; });
const stepPx = () => (story.offsetHeight - innerHeight) / STEPS;
function storyProgress() {
  const span = story.offsetHeight - innerHeight;
  const raw = (scrollY - story.offsetTop) / stepPx();
  const p = Math.min(STEPS, Math.max(0, raw));
  const after = (scrollY - (story.offsetTop + span)) / innerHeight;
  return { p, after };
}

// hotspots: inspection notes (step 2) and material notes (step 5)
const HS = {
  2: [['Bahan: mesh / rajut', new THREE.Vector3(0.6, 1.05, 0.6)], ['Noda lumpur di upper', new THREE.Vector3(-0.9, 0.75, 0.66)], ['Sol mulai menguning', new THREE.Vector3(1.2, 0.14, 0.62)]],
  5: [['Mesh: sikat lembut, tanpa rendam', new THREE.Vector3(1.75, 0.4, 0.45)], ['Sol karet: sikat & bilas', new THREE.Vector3(-1.4, 0.12, 0.66)], ['Tali: dicuci terpisah', new THREE.Vector3(0.2, 1.25, 0.2)]]
};
let hsSet = -1;

// ---------- loop ----------
const clock = new THREE.Clock();
const cur = { p: 0 };
let active = -1;
const v3 = new THREE.Vector3(), tip = new THREE.Vector3(), lastTip = new THREE.Vector3();
const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), up = new THREE.Vector3(0, 1, 0);
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
let foamAcc = 0, dustAcc = 0, mistAcc = 0;
const hit = { ok: false, p: new THREE.Vector3(), n: new THREE.Vector3(0, 1, 0) };
const invWorld = new THREE.Matrix4();
function probe(x, z) {
  hit.ok = false; if (!nearMesh) return hit;
  world.updateMatrixWorld(); invWorld.copy(world.matrixWorld).invert();
  v3.set(x, 4, z).applyMatrix4(world.matrixWorld);
  ray.set(v3, down); ray.far = 8;
  const r = ray.intersectObject(nearMesh, false)[0];
  if (r) { hit.ok = true; hit.p.copy(r.point).applyMatrix4(invWorld); hit.n.copy(r.face.normal).transformDirection(nearMesh.matrixWorld); if (hit.n.y < 0.2) hit.n.set(0, 1, 0); }
  return hit;
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  const { p, after } = storyProgress();
  const k = 1 - Math.pow(0.0015, dt);
  cur.p += (p - cur.p) * (reduce || snap ? 1 : k);
  const P = cur.p;

  const idx = Math.min(STEPS, Math.max(0, Math.round(p - 0.08)));
  if (idx !== active) { active = idx; panels.forEach((el, i) => el.classList.toggle('on', i === idx)); dots.forEach((d, i) => d.classList.toggle('on', i === idx)); }
  const hint = document.getElementById('hint'); if (hint) hint.style.opacity = p > 0.15 ? 0 : 1;

  // camera
  const i0 = Math.min(STEPS - 1, Math.floor(P)), f = ss(0, 1, P - i0);
  const A = CAM[i0], B = CAM[Math.min(STEPS, i0 + 1)];
  const az = lerp(A.az, B.az, f), el = lerp(A.el, B.el, f), d = lerp(A.d, B.d, f) * (mobile ? 1.5 : 1);
  const tx = lerp(A.tx, B.tx, f), ty = lerp(A.ty, B.ty, f), tz = lerp(A.tz, B.tz, f);
  camera.position.set(tx + Math.cos(az) * Math.cos(el) * d, ty + Math.sin(el) * d, tz + Math.sin(az) * Math.cos(el) * d);
  camera.lookAt(tx, ty, tz);

  // leaving the story: the set tilts away and rises, the next section rotates in
  const out = ss(0.1, 1.1, after);
  world.position.y = out * 6.5;
  world.rotation.x = -out * 0.35;
  world.visible = out < 0.99;

  // pair: drag + gentle sway; lifted at pickup
  if (!dragging) { yawVel *= 0.92; userYaw += yawVel; }
  const lift = bell(P, 0.75, 1.3, 0.35);
  pair.rotation.y = userYaw + (reduce ? 0 : Math.sin(t * 0.5) * 0.06);
  pair.rotation.z = lift * 0.05;
  pair.position.y = lift * 0.45 + (reduce ? 0 : Math.sin(t * 1.1) * 0.025);

  // dirt → clean → white
  U.uDust.value = 1 - ss(2.7, 3.45, P);
  U.uMud.value = 1 - 0.2 * ss(2.8, 3.4, P) - 0.72 * ss(3.65, 4.4, P) - 0.08 * ss(4.6, 5.2, P);
  U.uSweep.value = P < 5.5 ? -10 : P > 6.45 ? 10 : lerp(-2.6, 2.6, ss(5.6, 6.35, P));
  const sheen = bell(P, 6.7, 7.4, 0.3);
  shoeMats.forEach(m => { m.envMapIntensity = 1 + sheen * 0.9; });

  // ID tag (pickup)
  const tg = bell(P, 0.65, 1.45, 0.25);
  tag.visible = tg > 0.02; tag.scale.setScalar(Math.max(0.001, tg));
  tag.rotation.z = Math.sin(t * 2.1) * 0.08; tag.rotation.y = Math.sin(t * 1.3) * 0.15 - 0.2;

  // scanner + photo flash (inspection)
  const scan = bell(P, 1.75, 2.45, 0.2);
  ring.visible = scan > 0.01; ring.material.opacity = scan;
  ringG.position.set(-2.6 + ((t * 0.5) % 1) * 5.2, 1.0, 0);
  ringLight.position.copy(ringG.position); ringLight.intensity = 6 * scan;
  flash.intensity = scan * Math.pow(Math.max(0, Math.sin(t * 2.6)), 40) * 60;

  // basic cleaning: dust lifts off the surface
  const ba = bell(P, 2.8, 3.35, 0.25);
  if (ba > 0.05 && samples.length && !reduce) {
    dustAcc += dt * 140 * ba;
    while (dustAcc > 1) { dustAcc--; const s = samples[(Math.random() * samples.length) | 0]; emit(dust, s.p.x, s.p.y + pair.position.y, s.p.z, s.n.x * 0.7 + rnd(-0.2, 0.2), Math.abs(s.n.y) * 0.4 + rnd(0.3, 0.8), s.n.z * 0.7 + rnd(-0.2, 0.2), rnd(1.2, 2.2), rnd(0.18, 0.42)); }
  }
  stepParticles(dust, dt, 0.5, 0.985, 1.006);

  // deep cleaning (big strokes on the vamp) & special treatment (small careful strokes at the toe)
  const deep = bell(P, 3.8, 4.35, 0.25), spec = bell(P, 4.8, 5.3, 0.25);
  const br = Math.max(deep, spec);
  brush.visible = br > 0.01 && shoeReady;
  if (brush.visible) {
    const sx = deep >= spec ? 0.65 + Math.sin(t * 1.9) * 0.65 + Math.sin(t * 5.1) * 0.12 : 1.45 + Math.sin(t * 1.2) * 0.22;
    const sz = 0.88 + (deep >= spec ? Math.cos(t * 5.1) * 0.12 + Math.sin(t * 0.7) * 0.1 : Math.cos(t * 2.4) * 0.08);
    const h = probe(sx, sz);
    const baseY = h.ok ? h.p.y : 0.9;
    const press = deep >= spec ? 0.2 + Math.sin(t * 10.2) * 0.015 : 0.24;
    tip.set(sx, baseY, sz);
    qb.setFromUnitVectors(up, h.ok ? h.n : up);
    qa.setFromAxisAngle(up, 0.2 + Math.sin(t * 0.9) * 0.15);
    brush.quaternion.slerp(qb.multiply(qa), 1 - Math.pow(0.002, dt));
    v3.set(0, press, 0).applyQuaternion(brush.quaternion);
    const lift2 = (1 - br) * 2.2;
    brush.position.set(tip.x + v3.x, tip.y + v3.y + lift2, tip.z + v3.z);
    brush.scale.setScalar(deep >= spec ? 0.85 : 0.7);
    // bristles trail behind the stroke
    const vx = (tip.x - lastTip.x) / Math.max(dt, 1e-3), vz = (tip.z - lastTip.z) / Math.max(dt, 1e-3);
    uBend.value.x = lerp(uBend.value.x, THREE.MathUtils.clamp(-vx * 0.035, -0.07, 0.07), 0.3);
    uBend.value.y = lerp(uBend.value.y, THREE.MathUtils.clamp(-vz * 0.035, -0.07, 0.07), 0.3);
    lastTip.copy(tip);
    if (h.ok && deep > 0.4 && !reduce) { foamAcc += dt * 22; while (foamAcc > 1) { foamAcc--; spawnFoam(h.p, h.n); } }
  }
  foam.forEach(m => {
    const u = m.userData; if (u.life <= 0) { m.visible = false; return; }
    u.life -= dt * (P > 4.6 ? 3 : 1);
    const f2 = u.life / u.max; m.scale.setScalar(u.s * Math.min(1, (1 - f2) * 8) * (0.4 + 0.6 * Math.sqrt(f2)));
  });

  // whitening: a light curtain sweeps from heel to toe and leaves the sole white behind it
  const wh = bell(P, 5.6, 6.35, 0.15);
  curtain.material.uniforms.a.value = wh;
  curtain.visible = wh > 0.01;
  curtain.position.x = U.uSweep.value;
  curtainLight.position.set(U.uSweep.value, 0.6, 1.8); curtainLight.intensity = wh * 5;

  // shoe care: a fine mist, then everything sparkles at QC
  const sc2 = bell(P, 6.7, 7.35, 0.25);
  if (sc2 > 0.05 && !reduce) {
    mistAcc += dt * 160 * sc2;
    while (mistAcc > 1) { mistAcc--; const tx2 = rnd(-1.8, 1.8), tz2 = rnd(-1.2, 1.2); emit(mist, -2.2 + rnd(-0.1, 0.1), 2.9 + rnd(-0.1, 0.1), 2.2, (tx2 + 2.2) * 0.9, (0.7 - 2.9) * 0.9 + rnd(-0.2, 0.2), (tz2 - 2.2) * 0.9, rnd(1.0, 1.6), rnd(0.12, 0.3)); }
  }
  stepParticles(mist, dt, 0.35, 0.97, 1.012);
  const sp = Math.max(bell(P, 7.0, 7.6, 0.3), ss(7.95, 8.0, P) * 0);
  for (let i = 0; i < spark.n; i++) spark.al[i] = sp * Math.pow(Math.max(0, Math.sin(t * 2.2 + sparkPh[i])), 10);
  spark.geo.attributes.aAlpha.needsUpdate = true;
  spark.pts.position.y = pair.position.y;

  // ziplock: drops over the pair, the mouth closes, the slider runs along the zipper
  const bagIn = ss(7.25, 7.8, P), pinch = ss(7.65, 7.95, P), zip = ss(7.85, 8.0, P);
  bagG.visible = bagIn > 0.02;
  bagG.position.y = 7 * (1 - bagIn);
  plastic.uniforms.uA.value = bagIn;
  label.material.opacity = bagIn;
  shapeBag(pinch);
  seam.visible = pinch > 0.97;
  slider.position.x = lerp(-BW / 2 + 0.15, BW / 2 - 0.15, zip);

  // hotspots
  const set = bell(P, 1.75, 2.45, 0.2) > 0.6 ? 2 : bell(P, 4.8, 5.3, 0.2) > 0.6 ? 5 : -1;
  if (set !== hsSet) { hsSet = set; if (set > 0) hotspots.forEach((h, i) => { h.querySelector('span').textContent = HS[set][i][0]; }); }
  hotspots.forEach((h, i) => {
    if (set < 0 || !shoeReady) { h.classList.remove('on'); return; }
    v3.copy(HS[set][i][1]); shoeR.localToWorld(v3); v3.project(camera);
    const x = (v3.x * 0.5 + 0.5) * W, y = (-v3.y * 0.5 + 0.5) * H;
    const flip = x > W * 0.62;
    h.classList.toggle('flip', flip);
    h.style.transform = flip ? `translate(calc(${x + 6}px - 100%), ${y - 6}px)` : `translate(${x - 6}px, ${y - 6}px)`;
    h.classList.toggle('on', v3.z < 1);
  });

  ambient.forEach(b => { if (!reduce) { b.position.y += b.userData.v * dt; b.position.x += Math.sin(t * 0.6 + b.userData.w) * 0.002; } if (b.position.y > 8) b.position.y = -2; });
  bubbleMat.uniforms.t.value = t;

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
