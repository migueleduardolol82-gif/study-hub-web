import * as THREE from 'three';

export type AvatarFocus = 'corpo' | 'meio' | 'rosto' | 'equipamentos' | 'calcados';

/** Bounds are measured once after geometry/pose changes, never from decorative auras. */
export function measureAvatar(root: THREE.Object3D) {
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(root, true);
  const size = bounds.getSize(new THREE.Vector3());
  let head: THREE.Object3D | undefined;
  root.traverse(object => {
    if (!head && /^(CC_Base_Head|Head|head)$/i.test(object.name)) head = object;
  });
  return {bounds, head: head?.getWorldPosition(new THREE.Vector3()), size};
}

export function frameAvatar(measurement: ReturnType<typeof measureAvatar>, focus: AvatarFocus, aspect: number, fov: number, zoom = 1) {
  const {bounds, head, size} = measurement;
  const region = bounds.clone();
  const height = Math.max(size.y, 0.001);
  if (focus === 'rosto') {
    // Neck/head landmark, with upper-body proportion only as a missing-rig fallback.
    region.min.y = head ? Math.max(bounds.min.y, head.y - height * .07) : bounds.max.y - height * .28;
    const width = height * .32;
    const centerX = head?.x ?? bounds.getCenter(new THREE.Vector3()).x;
    region.min.x = centerX - width / 2;
    region.max.x = centerX + width / 2;
  } else if (focus === 'meio' || focus === 'equipamentos') {
    region.min.y = bounds.min.y + height * .42;
  } else if (focus === 'calcados') {
    region.max.y = bounds.min.y + height * .24;
  }
  const target = region.getCenter(new THREE.Vector3());
  const extent = region.getSize(new THREE.Vector3());
  const halfFov = THREE.MathUtils.degToRad(fov / 2);
  const fit = Math.max(extent.y, extent.x / Math.max(aspect, .1)) / (2 * Math.tan(halfFov));
  const distance = Math.max(extent.z / 2 + height * .08, fit * 1.12 / THREE.MathUtils.clamp(zoom, .65, 1.8) + extent.z / 2);
  return {target, position: target.clone().add(new THREE.Vector3(0, 0, distance))};
}
