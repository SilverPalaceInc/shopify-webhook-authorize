import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const params = new URLSearchParams(location.search);
const capture = params.has('capture');
const SIZE = capture ? Number(params.get('size') || 1080) : null;
const LOOP_SECONDS = 8; // one full turn; constant motion -> linear

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: capture });
renderer.setPixelRatio(capture ? 1 : Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#ffffff');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(28, 1, 1, 1000);
camera.position.set(0, 58, 96);
camera.lookAt(0, -2, 0);

// Light for crisp highlights + the soft contact shadow on the "table".
const key = new THREE.DirectionalLight('#ffffff', 1.4);
key.position.set(30, 90, 40);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 10, far: 250 });
key.shadow.radius = 6;
scene.add(key);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.ShadowMaterial({ opacity: 0.13 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.6;
ground.receiveShadow = true;
scene.add(ground);

const silver = new THREE.MeshPhysicalMaterial({
  color: '#eceef2',
  metalness: 1,
  roughness: 0.09,
  clearcoat: 0.4,
  clearcoatRoughness: 0.08,
  envMapIntensity: 1.0,
});

// ---------- Necklace path: a relaxed loop lying on the table ----------
const necklace = new THREE.Group();
scene.add(necklace);

const LINKS = 96;
const PITCH = 1.28;
const CLASP_GAP = 11; // links replaced by clasp hardware
const circumference = LINKS * PITCH;
const R = circumference / (2 * Math.PI);

function pathPoint(u) {
  // Slightly egg-shaped so it reads as a necklace laid down, not a perfect ring.
  const a = u * Math.PI * 2;
  const r = R * (1 + 0.06 * Math.cos(a));
  return new THREE.Vector3(Math.cos(a) * r * 1.05, 0, Math.sin(a) * r * 0.95);
}
function frameAt(u) {
  const p = pathPoint(u);
  const t = pathPoint(u + 1e-4).sub(pathPoint(u - 1e-4)).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(up, t).normalize();
  return { p, t, side, up };
}

// ---------- Curb (Cuban) links: oval rings, alternately twisted, then pressed flat ----------
const linkGeo = new THREE.TorusGeometry(1.2, 0.56, 22, 56);
linkGeo.scale(1.3, 1, 1); // long axis along x
const links = new THREE.InstancedMesh(linkGeo, silver, LINKS - CLASP_GAP);
links.castShadow = true;

const m = new THREE.Matrix4();
const basis = new THREE.Matrix4();
const flatten = new THREE.Matrix4().makeScale(1, 1, 1);
const twist = new THREE.Matrix4();
const TWIST = THREE.MathUtils.degToRad(20);
const YAW = THREE.MathUtils.degToRad(38);
const yaw = new THREE.Matrix4().makeRotationZ(YAW);
let k = 0;
for (let i = 0; i < LINKS; i++) {
  if (i < Math.ceil(CLASP_GAP / 2) || i >= LINKS - Math.floor(CLASP_GAP / 2)) continue;
  const u = i / LINKS;
  const { p, t, side, up } = frameAt(u);
  // local x -> tangent, local y -> side, local z -> up
  basis.makeBasis(t, side, up).setPosition(p);
  // Flatten in the chain's thickness direction (world up), applied in the path frame.
  flatten.makeScale(1, 1, 0.5);
  twist.makeRotationX((i % 2 ? 1 : -1) * TWIST);
  m.copy(basis).multiply(flatten).multiply(yaw).multiply(twist);
  links.setMatrixAt(k++, m);
}
links.instanceMatrix.needsUpdate = true;
necklace.add(links);

// ---------- Clasp hardware ----------
function placeAt(obj, u, extra = new THREE.Matrix4()) {
  const { p, t, side, up } = frameAt(u);
  const b = new THREE.Matrix4().makeBasis(t, side, up).setPosition(p).multiply(extra);
  obj.matrixAutoUpdate = false;
  obj.matrix.copy(b);
  obj.castShadow = true;
  necklace.add(obj);
}
const uStart = (Math.ceil(CLASP_GAP / 2) - 0.6) / LINKS; // end of chain on one side
const uEnd = (LINKS - Math.floor(CLASP_GAP / 2) - 0.4) / LINKS;

// End caps (the "925 ITALY" tubes)
const capGeo = new THREE.CapsuleGeometry(1.25, 2.6, 8, 24);
capGeo.rotateZ(Math.PI / 2);
capGeo.scale(1, 1, 0.62);
placeAt(new THREE.Mesh(capGeo, silver), uStart - 1.6 / circumference);
placeAt(new THREE.Mesh(capGeo, silver), uEnd + 1.6 / circumference);

// Jump ring
const ringGeo = new THREE.TorusGeometry(0.9, 0.22, 16, 40);
placeAt(new THREE.Mesh(ringGeo, silver), uStart - 4.3 / circumference,
  new THREE.Matrix4().makeRotationX(Math.PI / 2 - 0.3));

// Lobster clasp body: thick flattened oval + spring gate
const lobsterGeo = new THREE.TorusGeometry(1.7, 0.62, 20, 48);
lobsterGeo.scale(1.9, 1, 0.6);
placeAt(new THREE.Mesh(lobsterGeo, silver), uStart - 8.2 / circumference);
const plateGeo = new THREE.BoxGeometry(3.8, 2.2, 0.9);
placeAt(new THREE.Mesh(plateGeo, silver), uStart - 8.6 / circumference);
// Ring on the other end that the clasp hooks into
placeAt(new THREE.Mesh(ringGeo, silver), uEnd + 4.0 / circumference,
  new THREE.Matrix4().makeRotationX(0.25));

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
window.__LOOP = LOOP_SECONDS;

if (!capture) {
  if (reduce) render(1.2);
  else {
    const t0 = performance.now();
    renderer.setAnimationLoop(() => render((performance.now() - t0) / 1000));
  }
}
