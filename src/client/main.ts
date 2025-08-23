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

  // Realistic glass sphere (terrarium shell)
  const shellGeo = new THREE.DodecahedronGeometry(0.8, 0); // 12 flat faces
  const glass = new THREE.Mesh(shellGeo, glassMat);
  scene.add(glass);

  const edges = new THREE.EdgesGeometry(shellGeo);
  const frame = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({
      color: 0x3b2f2f,
      transparent: true,
      opacity: 0.9,
    })
  );

  glass.add(frame);

  // Ground to catch subtle reflections
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(2.5, 64),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.85;
  scene.add(ground);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.2;
  controls.maxDistance = 5;
  controls.target.set(0, 0, 0);
  controls.update();

  window.addEventListener('resize', onWindowResize, false);
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
