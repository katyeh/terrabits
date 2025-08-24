import * as THREE from 'three';
import { getBottomFacePolygon, getBottomFaceY } from "./geometry";
import { SOIL_HEIGHT } from "./constants";

export function createSoilFromShell(glass: THREE.Mesh): THREE.Mesh | null {
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