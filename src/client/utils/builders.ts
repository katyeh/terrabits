import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';
import { CAMERA_FOV, CAMERA_NEAR, CAMERA_FAR, TONE_MAPPING_EXPOSURE, DPR_CAP } from './constants';

export function createRenderer(canvas: HTMLCanvasElement) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, DPR_CAP));
    r.setSize(window.innerWidth, window.innerHeight);
    r.physicallyCorrectLights = true;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = TONE_MAPPING_EXPOSURE;
    return r;
  }
  
export function createCamera() {
    const camera = new THREE.PerspectiveCamera(
        CAMERA_FOV,
        window.innerWidth / window.innerHeight,
        CAMERA_NEAR,
        CAMERA_FAR
    );
    camera.position.set(0, 0.4, 2.2);
    return camera;
}

export function createEnv(renderer: THREE.WebGLRenderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    return env;
}

export function createLights(scene: THREE.Scene) {
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(2, 3, 2);
    dir.castShadow = false;
    scene.add(dir);
}

export function createControls(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
    const c = new OrbitControls(camera, dom);
    c.enableDamping = true;
    c.minDistance = 1.2;
    c.maxDistance = 5;
    c.target.set(0, 0, 0);
    c.update();
    return c;
}