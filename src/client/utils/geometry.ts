import * as THREE from 'three';

export function alignFaceDown(mesh: THREE.Mesh) {
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

export function getBottomFaceY(mesh: THREE.Mesh): number {
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

export function getBottomFacePolygon(
  glass: THREE.Mesh,
  floorY: number,
  epsilon = 1e-3
): THREE.Vector2[] {
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
