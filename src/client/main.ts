import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

type PhysicalGlass = THREE.MeshPhysicalMaterial & {
  transmission: number;
  thickness: number;
  ior: number;
  attenuationColor: THREE.Color;
  attenuationDistance: number;
  specularIntensity: number;
};

const SHELL_RADIUS = 0.8;
const SOIL_HEIGHT = 0.12;

const CAMERA_FOV = 60;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 100;

const TONE_MAPPING_EXPOSURE = 1.0;
const DPR_CAP = 2;

function createRenderer(canvas: HTMLCanvasElement) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio, DPR_CAP));
  r.setSize(window.innerWidth, window.innerHeight);
  r.physicallyCorrectLights = true;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = TONE_MAPPING_EXPOSURE;
  return r;
}

function createCamera() {
  camera = new THREE.PerspectiveCamera(
    CAMERA_FOV,
    window.innerWidth / window.innerHeight,
    CAMERA_NEAR,
    CAMERA_FAR
  );
  camera.position.set(0, 0.4, 2.2);
  return camera;
}

function createEnv(renderer: THREE.WebGLRenderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return env;
}

function createLights(scene: THREE.Scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(2, 3, 2);
  dir.castShadow = false;
  scene.add(dir);
}

function createControls(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
  const c = new OrbitControls(camera, dom);
  c.enableDamping = true;
  c.minDistance = 1.2;
  c.maxDistance = 5;
  c.target.set(0, 0, 0);
  c.update();
  return c;
}

function createGlassMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.08,
    envMapIntensity: 1.0,
  }) as PhysicalGlass;
}

function createGlassShell(mat: THREE.Material) {
  const geo = new THREE.DodecahedronGeometry(SHELL_RADIUS, 0); // 12 flat faces
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, geo };
}

function createSoilFromShell(glass: THREE.Mesh): THREE.Mesh | null {
  const floorY = getBottomFaceY(glass);
  const basePts = getBottomFacePolygon(glass, floorY);
  if (basePts.length < 3) return null;

  const soilMat = new THREE.MeshStandardMaterial({
    color: 0x6d5331,
    roughness: 0.95,
    metalness: 0.0,
  });

  const center = basePts
    .reduce((a, p) => a.add(p), new THREE.Vector2())
    .multiplyScalar(1 / basePts.length);

  const inset = 0.996;
  const insetPts = basePts.map((p) => p.clone().sub(center).multiplyScalar(inset));
  const shape = new THREE.Shape(insetPts);

  const soilGeo = new THREE.ExtrudeGeometry(shape, {
    depth: SOIL_HEIGHT,
    bevelEnabled: false,
    steps: 1,
  });
  soilGeo.rotateX(-Math.PI / 2);

  const soil = new THREE.Mesh(soilGeo, soilMat);
  const soilY = floorY + SOIL_HEIGHT / 2 - 0.001; // sink slightly to appear flush
  soil.position.set(center.x, soilY, center.y); // put it back under the glass
  soil.rotation.y = THREE.MathUtils.degToRad(36);

  return soil;
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(): void {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

let scene!: THREE.Scene;
let camera!: THREE.PerspectiveCamera;
let renderer!: THREE.WebGLRenderer;
let controls!: OrbitControls;

function alignFaceDown(mesh: THREE.Mesh) {
  const geom = mesh.geometry as THREE.BufferGeometry;
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const index = geom.getIndex(); // may be null

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const faceNormal = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);

  let bestDot = -Infinity;
  const bestNormal = new THREE.Vector3();

  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(pos, index.getX(i + 0));
      b.fromBufferAttribute(pos, index.getX(i + 1));
      c.fromBufferAttribute(pos, index.getX(i + 2));
      faceNormal.copy(b).sub(a).cross(c.clone().sub(a)).normalize();
      const dot = faceNormal.dot(down);
      if (dot > bestDot) {
        bestDot = dot;
        bestNormal.copy(faceNormal);
      }
    }
  } else {
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i + 0);
      b.fromBufferAttribute(pos, i + 1);
      c.fromBufferAttribute(pos, i + 2);
      faceNormal.copy(b).sub(a).cross(c.clone().sub(a)).normalize();
      const dot = faceNormal.dot(down);
      if (dot > bestDot) {
        bestDot = dot;
        bestNormal.copy(faceNormal);
      }
    }
  }

  if (bestDot === -Infinity) return; // safety
  const quat = new THREE.Quaternion().setFromUnitVectors(bestNormal, down);
  mesh.applyQuaternion(quat);
}

function getBottomFaceY(mesh: THREE.Mesh): number {
  const geom = mesh.geometry as THREE.BufferGeometry;
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const index = geom.getIndex();

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);

  let bestDot = -Infinity;
  let ySum = 0;
  let yCount = 0;

  const readTri = (ia: number, ib: number, ic: number) => {
    a.fromBufferAttribute(pos, ia).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(pos, ib).applyMatrix4(mesh.matrixWorld);
    c.fromBufferAttribute(pos, ic).applyMatrix4(mesh.matrixWorld);
    n.copy(b).sub(a).cross(c.clone().sub(a)).normalize();
    const dot = n.dot(down);
    if (dot > bestDot) {
      bestDot = dot;
      ySum = a.y + b.y + c.y;
      yCount = 3;
    }
  };

  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      readTri(index.getX(i), index.getX(i + 1), index.getX(i + 2));
    }
  } else {
    for (let i = 0; i < pos.count; i += 3) {
      readTri(i, i + 1, i + 2);
    }
  }

  return yCount ? ySum / yCount : -0.56; // fallback close to previous value
}

function getBottomFacePolygon(glass: THREE.Mesh, floorY: number, epsilon = 1e-3): THREE.Vector2[] {
  const geom = glass.geometry as THREE.BufferGeometry;
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const wv = new THREE.Vector3();
  const pts: THREE.Vector2[] = [];

  const addUnique = (p: THREE.Vector2) => {
    for (const q of pts) {
      if (p.distanceToSquared(q) < epsilon * epsilon) return;
    }
    pts.push(p);
  };

  for (let i = 0; i < pos.count; i++) {
    wv.fromBufferAttribute(pos, i).applyMatrix4(glass.matrixWorld);
    if (Math.abs(wv.y - floorY) < 1e-3) {
      addUnique(new THREE.Vector2(wv.x, wv.z));
    }
  }

  if (pts.length < 3) return pts;

  // order around centroid for a valid polygon
  const center = pts
    .reduce((acc, p) => acc.add(p), new THREE.Vector2())
    .multiplyScalar(1 / pts.length);
  pts.sort(
    (p1, p2) =>
      Math.atan2(p1.y - center.y, p1.x - center.x) - Math.atan2(p2.y - center.y, p2.x - center.x)
  );
  return pts;
}

init();
animate();

function init(): void {
  const canvas = document.getElementById('bg') as HTMLCanvasElement;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);

  camera = createCamera();
  renderer = createRenderer(canvas);
  scene.environment = createEnv(renderer);

  // Lighting
  createLights(scene);
  const glassMat = createGlassMaterial();
  glassMat.transmission = 1.0;
  glassMat.thickness = 0.2;
  glassMat.ior = 1.5;
  glassMat.attenuationColor = new THREE.Color(0x8a8a8a); // faint smoke
  glassMat.attenuationDistance = 2.2;
  glassMat.specularIntensity = 0.9;

  // Brightness for glass
  glassMat.roughness = 0.06;
  glassMat.envMapIntensity = 1.2;
  glassMat.attenuationColor = new THREE.Color(0xffffff);
  glassMat.attenuationDistance = 3.0;

  // Realistic glass sphere (terrarium shell)
  const { mesh: glass, geo: shellGeo } = createGlassShell(glassMat);
  scene.add(glass);

  alignFaceDown(glass);
  glass.updateMatrixWorld(true);

  // Compute bottom face height and place soil precisely inside the glass
  const soil = createSoilFromShell(glass);

  if (soil) {
    scene.add(soil);
  }

  const edges = new THREE.EdgesGeometry(shellGeo);
  const frame = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({
      color: 0x3b2f2f,
      transparent: true,
      opacity: 0.9,
    })
  );

  frame.scale.setScalar(1.001);
  glass.add(frame);

  controls = createControls(camera, renderer.domElement);
  window.addEventListener('resize', onWindowResize, false);
}
