import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const params = new URLSearchParams(location.search);
const capture = params.has('capture');
const SIZE = capture ? Number(params.get('size') || 1080) : null;
const LOOP_SECONDS = 10; // one full turn; constant motion -> linear

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: capture });
renderer.setPixelRatio(capture ? 1 : Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#f7f7f8');

// ---------- Jewelry studio reflections: dark room + big softboxes ----------
// Polished metal looks like whatever it reflects. Dark surroundings with bright strip lights
// give silver its contrast; a plain white room makes it look grey and plastic.
function studioEnv() {
  const env = new THREE.Scene();
  env.background = new THREE.Color('#8e9095');
  const panel = (w, h, color, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  const white = (k) => new THREE.Color(1, 1, 1).multiplyScalar(k);
  // The ground-flat tops reflect up-and-back toward this softbox, so they always flash bright.
  panel(16, 7, white(1.15), [0, 6, -10]);
  panel(14, 4, white(1.6), [0, 10, 0]);
  panel(4, 10, white(1.8), [-10, 3, 2]);
  panel(4, 10, white(1.6), [10, 3, 0]);
  // Dark flags: give the polished edges defined black lines, like a real jewelry shot.
  panel(1.4, 12, '#121316', [-6, 3, -8]);
  panel(1.4, 12, '#121316', [6.5, 3, -7]);
  panel(18, 1.6, '#16171a', [0, 1.2, 10]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: '#5d5f63', side: THREE.DoubleSide }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -7;
  env.add(floor);
  return env;
}
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(studioEnv(), 0.02).texture;

const camera = new THREE.PerspectiveCamera(24, 1, 1, 1000);
camera.position.set(0, 50, 104);
camera.lookAt(0, -3, 0);

const key = new THREE.DirectionalLight('#ffffff', 2.2);
key.position.set(20, 80, 30);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 10, far: 200 });
key.shadow.radius = 8;
scene.add(key);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.16 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.95;
ground.receiveShadow = true;
scene.add(ground);

const silver = new THREE.MeshPhysicalMaterial({
  color: '#f2f3f5',
  metalness: 1,
  roughness: 0.06,
  envMapIntensity: 1.0,
});

// ---------- Necklace path: a loop lying on the table ----------
const necklace = new THREE.Group();
scene.add(necklace);

const LINKS = 76;
const PITCH = 1.5;
const CLASP_GAP = 9;
const circumference = LINKS * PITCH;
const R = circumference / (2 * Math.PI);

function pathPoint(u) {
  const a = u * Math.PI * 2;
  const r = R * (1 + 0.05 * Math.cos(a));
  return new THREE.Vector3(Math.cos(a) * r * 1.06, 0, Math.sin(a) * r * 0.94);
}
function frameAt(u) {
  const p = pathPoint(u);
  const t = pathPoint(u + 1e-4).sub(pathPoint(u - 1e-4)).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(up, t).normalize();
  return { p, t, side, up };
}

// ---------- Cuban links ----------
// Built like the real thing: an oval ring, twisted so neighbours interlock, then ground flat
// top and bottom. Those flat ground faces are what make a Cuban chain flash.
const baseLink = new THREE.TorusGeometry(1.3, 0.44, 28, 96);
baseLink.scale(1.32, 1, 1);
const YAW = THREE.MathUtils.degToRad(36);
const TWIST = THREE.MathUtils.degToRad(24);
const CUT = 0.68; // fraction of the link's height kept after grinding

const pieces = [];
const m = new THREE.Matrix4();
const nm = new THREE.Matrix3();
for (let i = 0; i < LINKS; i++) {
  if (i < Math.ceil(CLASP_GAP / 2) || i >= LINKS - Math.floor(CLASP_GAP / 2)) continue;
  const { p, t, side, up } = frameAt(i / LINKS);
  m.makeBasis(t, side, up)
    .multiply(new THREE.Matrix4().makeRotationZ(YAW))
    .multiply(new THREE.Matrix4().makeRotationX((i % 2 ? 1 : -1) * TWIST));
  const g = baseLink.clone().applyMatrix4(m); // rotated about origin; y is world-up
  const pos = g.attributes.position, nor = g.attributes.normal;
  let maxY = 0;
  for (let v = 0; v < pos.count; v++) maxY = Math.max(maxY, Math.abs(pos.getY(v)));
  const h = maxY * CUT;
  for (let v = 0; v < pos.count; v++) {
    const y = pos.getY(v);
    if (y > h) { pos.setY(v, h); nor.setXYZ(v, 0, 1, 0); }
    else if (y < -h) { pos.setY(v, -h); nor.setXYZ(v, 0, -1, 0); }
  }
  g.translate(p.x, p.y, p.z);
  pieces.push(g);
}
const chain = new THREE.Mesh(mergeGeometries(pieces), silver);
chain.castShadow = true;
necklace.add(chain);

// ---------- Clasp hardware ----------
function placeAt(geo, u, extra = new THREE.Matrix4()) {
  const { p, t, side, up } = frameAt(u);
  const mesh = new THREE.Mesh(geo, silver);
  mesh.matrixAutoUpdate = false;
  mesh.matrix.makeBasis(t, side, up).setPosition(p).multiply(extra);
  mesh.castShadow = true;
  necklace.add(mesh);
}
const uA = (Math.ceil(CLASP_GAP / 2) - 0.5) / LINKS;
const uB = (LINKS - Math.floor(CLASP_GAP / 2) - 0.5) / LINKS;
const du = (d) => d / circumference;

// Box end caps with rounded edges, ground flat like the links
const capGeo = new THREE.CapsuleGeometry(1.15, 2.4, 10, 32);
capGeo.rotateZ(Math.PI / 2);
capGeo.scale(1, 1.25, 0.62);
placeAt(capGeo, uA - du(1.7));
placeAt(capGeo, uB + du(1.7));

// Jump rings
const ringGeo = new THREE.TorusGeometry(0.75, 0.2, 18, 48);
placeAt(ringGeo, uA - du(4.1), new THREE.Matrix4().makeRotationX(Math.PI / 2));
placeAt(ringGeo, uB + du(3.9), new THREE.Matrix4().makeRotationX(0.3));

// Lobster clasp: rounded body shell + flat face plate
const lobster = new THREE.TorusGeometry(1.25, 0.6, 24, 64);
lobster.scale(1.75, 1.05, 0.55);
placeAt(lobster, uA - du(7.1));
const plate = new THREE.CapsuleGeometry(0.95, 2.6, 8, 24);
plate.rotateZ(Math.PI / 2);
plate.scale(1, 1.05, 0.45);
placeAt(plate, uA - du(7.3), new THREE.Matrix4().makeTranslation(0, 0.25, 0.05));

// ---------- Render ----------
function resize() {
  const s = SIZE || Math.min(innerWidth, innerHeight);
  renderer.setSize(s, s, !capture);
  camera.aspect = 1;
  camera.updateProjectionMatrix();
}
resize();
addEventListener('resize', resize);

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function render(seconds) {
  necklace.rotation.y = (seconds / LOOP_SECONDS) * Math.PI * 2;
  renderer.render(scene, camera);
}
window.__render = render;

if (!capture) {
  if (reduce) render(1.5);
  else {
    const t0 = performance.now();
    renderer.setAnimationLoop(() => render((performance.now() - t0) / 1000));
  }
}
