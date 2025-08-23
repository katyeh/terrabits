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

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let soilMesh: THREE.Mesh | null = null;

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

// removed: measureClearRadius (replaced by polygon-based soil fit)

init();
animate();

function init(): void {
  const canvas = document.getElementById('bg') as HTMLCanvasElement;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0.4, 2.2);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  // No clipping needed for soil placement

  // Subtle reflections via PMREM + RoomEnvironment
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(2, 3, 2);
  dir.castShadow = false;
  scene.add(dir);

  // Material: place this before creating the geometry
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.08,
    envMapIntensity: 1.0,
  }) as PhysicalGlass;
  // Advanced props (older @types/three workaround)
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
  const shellGeo = new THREE.DodecahedronGeometry(0.8, 0); // 12 flat faces
  const glass = new THREE.Mesh(shellGeo, glassMat);
  scene.add(glass);

  alignFaceDown(glass);
  glass.updateMatrixWorld(true);

  // Compute bottom face height and place soil precisely inside the glass
  const floorY = getBottomFaceY(glass);

  const soilMat = new THREE.MeshStandardMaterial({
    color: 0x6d5331,
    roughness: 0.95,
    metalness: 0.0,
  });
  const soilHeight = 0.12;
  const soilY = floorY + soilHeight / 2 - 0.001; // sink slightly to appear flush
  const basePts = getBottomFacePolygon(glass, floorY);
  if (basePts.length >= 3) {
    const center = basePts
      .reduce((a, p) => a.add(p), new THREE.Vector2())
      .multiplyScalar(1 / basePts.length);
    const inset = 0.996; // tighter fit to edges

    // localize points so pivot is at (0,0)
    const insetPts = basePts.map((p) => p.clone().sub(center).multiplyScalar(inset));
    const shape = new THREE.Shape(insetPts);

    const soilGeo = new THREE.ExtrudeGeometry(shape, {
      depth: soilHeight,
      bevelEnabled: false,
      steps: 1,
    });
    soilGeo.rotateX(-Math.PI / 2);

    soilMesh = new THREE.Mesh(soilGeo, soilMat);
    soilMesh.position.set(center.x, soilY, center.y); // put it back under the glass
    scene.add(soilMesh);
    // rotate in 72° steps (0,72,144,216,288). Change the multiplier to 0..4
    soilMesh.rotation.y = THREE.MathUtils.degToRad(36);
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

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.2;
  controls.maxDistance = 5;
  controls.target.set(0, 0, 0);
  controls.update();

  window.addEventListener('resize', onWindowResize, false);

  // Rotate soil with keyboard (A/D)
  window.addEventListener('keydown', (e) => {
    if (!soilMesh) return;
    const step = THREE.MathUtils.degToRad(2);
    if (e.key === 'a' || e.key === 'A') soilMesh.rotation.y -= step;
    if (e.key === 'd' || e.key === 'D') soilMesh.rotation.y += step;
  });
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
