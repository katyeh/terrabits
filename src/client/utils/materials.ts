import * as THREE from 'three';
import { SHELL_RADIUS } from './constants';

export type PhysicalGlass = THREE.MeshPhysicalMaterial & {
  transmission: number;
  thickness: number;
  ior: number;
  attenuationColor: THREE.Color;
  attenuationDistance: number;
  specularIntensity: number;
};

export function createGlassMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.08,
    envMapIntensity: 1.0,
  }) as PhysicalGlass;
}

export function createGlassShell(mat: THREE.Material) {
  const geo = new THREE.DodecahedronGeometry(SHELL_RADIUS, 0); // 12 flat faces
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, geo };
}
