import * as THREE from 'three';
import { createCamera, createControls, createEnv, createLights, createRenderer } from './utils/builders';
import { alignFaceDown } from './utils/geometry';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { createGlassMaterial, createGlassShell } from './utils/materials';
import { createSoilFromShell } from './utils/soil';

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
