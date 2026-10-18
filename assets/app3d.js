// SoleVibe 3D scene: one procedural sneaker that travels with the scroll,
// gets cleaned while the "Layanan" section scrolls past, plus soap bubbles.
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

const canvas = document.getElementById('scene');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
} catch (e) { canvas.remove(); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 1, 10);

// lights: soft key + brand rim lights
scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2a1050, 0.6));
const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 6, 5); scene.add(key);
const rimPink = new THREE.PointLight(0xff4fa0, 40, 25); rimPink.position.set(-5, 2.5, -3); scene.add(rimPink);
const rimCyan = new THREE.PointLight(0x22d3ee, 40, 25); rimCyan.position.set(5, 3, -3); scene.add(rimCyan);

// the shoe: real glTF model ("Materials Variants Shoe" by Shopify, CC BY 4.0), with a mud overlay
const rig = new THREE.Group();      // position/scale from scroll
const spin = new THREE.Group();     // continuous rotation
rig.add(spin); scene.add(rig);
const mud = { value: 1 };           // 1 = dirty, 0 = clean
new GLTFLoader().load('assets/model/sepatu.glb', gltf => {
  const o = gltf.scene;
  const box = new THREE.Box3().setFromObject(o);
  const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const sc = 4 / size.x;                     // shoe length = 4 world units
  o.scale.setScalar(sc);
  o.position.set(-ctr.x * sc, -box.min.y * sc - 0.8, -ctr.z * sc);
  o.traverse(m => {
    if (!m.isMesh) return;
    m.material.envMapIntensity = 1.1;
    m.material.onBeforeCompile = sh => {
      sh.uniforms.uMud = mud;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uMud;
          float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
          float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
            return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
          float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*vn(p); p*=2.03; a*=.5; } return s; }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          #ifdef USE_MAP
            float n = fbm(vMapUv * 9.0);
            float spots = smoothstep(.52, .62, fbm(vMapUv * 26.0 + 3.1));
            float m = clamp(smoothstep(.60, .80, n) * .35 + spots * .8, 0., 1.) * uMud;
            vec3 mudCol = mix(vec3(.30,.22,.13), vec3(.46,.36,.22), vn(vMapUv*60.));
            float lum = dot(diffuseColor.rgb, vec3(.299,.587,.114));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * vec3(.93,.88,.78), uMud * .35); // dull + yellowed
            diffuseColor.rgb = mix(diffuseColor.rgb, mudCol, m);
          #endif`);
    };
    m.material.needsUpdate = true;
  });
  spin.add(o);
  document.documentElement.classList.add('shoe-ready');
});

// soft contact shadow under the shoe
const shCanvas = document.createElement('canvas'); shCanvas.width = shCanvas.height = 128;
const sctx = shCanvas.getContext('2d');
const grd = sctx.createRadialGradient(64, 64, 4, 64, 64, 62);
grd.addColorStop(0, 'rgba(5,6,24,.55)'); grd.addColorStop(1, 'rgba(5,6,24,0)');
sctx.fillStyle = grd; sctx.fillRect(0, 0, 128, 128);
const glow = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.4),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shCanvas), transparent: true, depthWrite: false }));
glow.rotation.x = -Math.PI / 2; glow.position.y = -0.82;
rig.add(glow);

// soap bubbles (fresnel, cyan→pink iridescence)
const bubbleMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { t: { value: 0 } },
  vertexShader: `varying vec3 vN; varying vec3 vV;
    void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `uniform float t; varying vec3 vN; varying vec3 vV;
    void main(){ float f = pow(1. - max(dot(vN,vV),0.), 2.4);
      vec3 c = mix(vec3(.13,.83,.93), vec3(1.,.31,.63), .5 + .5*sin(t*.6 + vN.y*3. + vN.x*2.));
      float spec = pow(max(dot(reflect(-vV,vN), normalize(vec3(-.5,.7,.6))),0.), 40.);
      gl_FragColor = vec4(c*f + vec3(spec), f*.85 + spec); }`
});
const bubbleGeo = new THREE.SphereGeometry(1, 32, 32);
const bubbles = [];
const COUNT = innerWidth < 640 ? 18 : 34;
for (let i = 0; i < COUNT; i++) {
  const m = new THREE.Mesh(bubbleGeo, bubbleMat);
  m.scale.setScalar(0.06 + Math.random() * 0.28);
  m.position.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 14, -3 - Math.random() * 6 + (Math.random() < 0.3 ? 6 : 0));
  m.userData = { v: 0.15 + Math.random() * 0.35, w: Math.random() * 6 };
  scene.add(m); bubbles.push(m);
}
// burst of foam that appears while cleaning
const foam = [];
for (let i = 0; i < 26; i++) {
  const m = new THREE.Mesh(bubbleGeo, bubbleMat);
  m.userData = { a: Math.random() * Math.PI * 2, r: 1.6 + Math.random() * 1.4, h: Math.random() * 2.2 - 0.6, s: 0.08 + Math.random() * 0.2, sp: 0.4 + Math.random() * 0.8 };
  rig.add(m); foam.push(m);
}

// ---- scroll choreography -------------------------------------------------
// x, y in world units at z=0; s = scale; tilt = rotation.x
const KF = {
  desk: {
    hero:    { x: 2.9,  y: 0.9,  s: 0.95, tilt: 0.28 },
    layanan: { x: 3.3,  y: 4.25, s: 0.58, tilt: 0.38 },
    bahan:   { x: 3.5,  y: 4.35, s: 0.50, tilt: 0.42 },
    harga:   { x: 3.4,  y: 4.35, s: 0.52, tilt: 0.42 },
    poin:    { x: 3.6,  y: 4.4, s: 0.42, tilt: 0.48 },
    order:   { x: 3.4,  y: 4.15, s: 0.52, tilt: 0.40 },
    final:   { x: 3.6,  y: 4.3,  s: 0.50, tilt: 0.32 }
  },
  mob: {
    hero:    { x: 0,    y: 3.65, s: 0.58, tilt: 0.30 },
    layanan: { x: 1.3,  y: 4.35, s: 0.27, tilt: 0.42 },
    bahan:   { x: 1.3,  y: 4.35, s: 0.27, tilt: 0.42 },
    harga:   { x: 1.3,  y: 4.35, s: 0.27, tilt: 0.45 },
    poin:    { x: 1.3,  y: 4.35, s: 0.27, tilt: 0.45 },
    order:   { x: 1.3,  y: 4.35, s: 0.27, tilt: 0.42 },
    final:   { x: 1.3,  y: 4.35, s: 0.27, tilt: 0.32 }
  }
};
const sections = [...document.querySelectorAll('[data-k]')];
const smooth = t => t * t * (3 - 2 * t);

function targetFromScroll() {
  const set = innerWidth < 640 ? KF.mob : KF.desk;
  const mid = scrollY + innerHeight * 0.5;
  const centers = sections.map(el => { const r = el.getBoundingClientRect(); return { k: el.dataset.k, top: r.top + scrollY, h: r.height, c: r.top + scrollY + r.height / 2 }; });
  let a = centers[0], b = centers[0], t = 0;
  if (mid <= centers[0].c) { a = b = centers[0]; }
  else if (mid >= centers.at(-1).c) { a = b = centers.at(-1); }
  else for (let i = 0; i < centers.length - 1; i++) {
    if (mid >= centers[i].c && mid < centers[i + 1].c) { a = centers[i]; b = centers[i + 1]; t = smooth((mid - a.c) / (b.c - a.c)); break; }
  }
  const A = set[a.k], B = set[b.k];
  const lay = centers.find(c => c.k === 'layanan');
  // cleaning runs while the Layanan section passes the middle of the screen
  const clean = lay ? Math.min(1, Math.max(0, (mid - lay.top) / (lay.h * 0.8))) : 1;
  return {
    x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, s: A.s + (B.s - A.s) * t, tilt: A.tilt + (B.tilt - A.tilt) * t,
    clean, foam: clean > 0.02 && clean < 0.98 ? Math.sin(clean * Math.PI) : 0
  };
}

// ---- resize / input ------------------------------------------------------
let W = 0, H = 0;
function resize() {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.fov = W < 640 ? 42 : 35;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
let mx = 0, my = 0;
addEventListener('pointermove', e => { mx = e.clientX / W - 0.5; my = e.clientY / H - 0.5; }, { passive: true });

// ---- animation loop --------------------------------------------------------
const cur = { x: 2.9, y: 0.9, s: 0.95, tilt: 0.28, clean: 0, foam: 0 };
const clock = new THREE.Clock();
let lastScroll = scrollY, spinBoost = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  const tg = targetFromScroll();
  const k = 1 - Math.pow(0.001, dt);              // frame-rate independent easing
  for (const p of ['x', 'y', 's', 'tilt', 'clean', 'foam']) cur[p] += (tg[p] - cur[p]) * k;

  // scroll velocity gives the shoe an extra twist
  spinBoost += (scrollY - lastScroll) * 0.0025; lastScroll = scrollY;
  spinBoost *= 0.92;

  rig.position.set(cur.x, cur.y - 1, 0);
  rig.scale.setScalar(cur.s);
  spin.rotation.y += reduce ? 0 : (0.35 * dt + spinBoost * 0.2);
  spin.rotation.x = cur.tilt + my * 0.15;
  spin.rotation.z = Math.sin(t * 0.8) * 0.04;
  rig.position.y += Math.sin(t * 1.3) * 0.06;

  mud.value = 1 - cur.clean;

  // foam orbiting while cleaning
  foam.forEach((f, i) => {
    const d = f.userData; const a = d.a + t * d.sp;
    f.position.set(Math.cos(a) * d.r, d.h + Math.sin(t * 2 + i) * 0.15, Math.sin(a) * d.r * 0.6);
    f.scale.setScalar(d.s * cur.foam);
    f.visible = cur.foam > 0.02;
  });

  bubbles.forEach(b => {
    if (!reduce) { b.position.y += b.userData.v * dt * 0.6; b.position.x += Math.sin(t * 0.7 + b.userData.w) * 0.002; }
    if (b.position.y > 8) b.position.y = -8;
  });
  bubbleMat.uniforms.t.value = t;

  camera.position.x += (mx * 0.6 - camera.position.x) * 0.05;
  camera.position.y += (1 - my * 0.4 - camera.position.y) * 0.05;
  camera.lookAt(0, 1, 0);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
