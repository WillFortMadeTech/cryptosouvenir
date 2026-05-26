import * as THREE from 'three'

export const textScene = new THREE.Scene()

// Ortho coordinate system: y from -1 (bottom) to +1 (top), x from -aspect to +aspect
const initAspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 16 / 9
export const orthoCamera = new THREE.OrthographicCamera(-initAspect, initAspect, 1, -1, 0.1, 100)
orthoCamera.position.z = 10

export function updateOrthoAspect(aspect: number) {
  orthoCamera.left   = -aspect
  orthoCamera.right  =  aspect
  orthoCamera.updateProjectionMatrix()
}
