import * as THREE from 'three'

const SPHERE_RADIUS     = 5
const SPHERE_RADIUS_SQ  = 25
const RIPPLE_SPEED      = 0.04
const RIPPLE_RING_WIDTH = 0.35
const RIPPLE_INITIAL_AMP = 0.35
const RIPPLE_AMP_DECAY  = 0.985
const RIPPLE_MAX_RADIUS = 11

export interface Ripple {
  origin: THREE.Vector3
  radius: number
  amp: number
}

const _diff     = new THREE.Vector3()
const _invMat   = new THREE.Matrix4()
const _localCam = new THREE.Vector3()
const _localOr  = new THREE.Vector3()
const _localDir = new THREE.Vector3()
const _hitPoint = new THREE.Vector3()

function raySphereHit(origin: THREE.Vector3, dir: THREE.Vector3, out: THREE.Vector3): boolean {
  const b = 2 * origin.dot(dir)
  const c = origin.lengthSq() - SPHERE_RADIUS_SQ
  const disc = b * b - 4 * c
  if (disc < 0) return false
  const t = (-b - Math.sqrt(disc)) / 2
  if (t < 0) return false
  out.copy(origin).addScaledVector(dir, t)
  return true
}

export function tickRipples(
  ripples: Ripple[],
  positions: THREE.Vector3[],
  rippleVoxels: Map<number, [number, number]>,
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene
): void {
  if (ripples.length === 0) return

  _invMat.copy(scene.matrixWorld).invert()
  _localCam.copy(camera.position).applyMatrix4(_invMat)

  for (let ri = ripples.length - 1; ri >= 0; ri--) {
    const r = ripples[ri]

    for (let i = 0; i < positions.length; i++) {
      if (positions[i].dot(_localCam) <= SPHERE_RADIUS_SQ) continue
      _diff.subVectors(positions[i], r.origin)
      const dist = _diff.length()
      const delta = dist - r.radius
      if (Math.abs(delta) >= RIPPLE_RING_WIDTH) continue
      const norm = delta / RIPPLE_RING_WIDTH
      const impulse = r.amp * Math.exp(-norm * norm * 4)
      const s = rippleVoxels.get(i)
      if (s) { s[1] = Math.min(s[1] + impulse, 0.5) }
      else { rippleVoxels.set(i, [0, Math.min(impulse, 0.5)]) }
    }

    r.radius += RIPPLE_SPEED
    r.amp *= RIPPLE_AMP_DECAY
    if (r.amp < 0.01 || r.radius > RIPPLE_MAX_RADIUS) ripples.splice(ri, 1)
  }
}

export function setupRippleClick(
  element: HTMLElement,
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  ripples: Ripple[]
): () => void {
  const raycaster = new THREE.Raycaster()
  const mouse     = new THREE.Vector2()
  let downX = 0
  let downY = 0

  const onPointerDown = (e: PointerEvent) => {
    downX = e.clientX
    downY = e.clientY
  }

  const onPointerUp = (e: PointerEvent) => {
    const dx = e.clientX - downX
    const dy = e.clientY - downY
    if (dx * dx + dy * dy > 25) return
    if (ripples.length > 0) return

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1

    raycaster.setFromCamera(mouse, camera)
    _invMat.copy(scene.matrixWorld).invert()
    _localOr.copy(raycaster.ray.origin).applyMatrix4(_invMat)
    _localDir.copy(raycaster.ray.direction).transformDirection(_invMat)

    if (raySphereHit(_localOr, _localDir, _hitPoint)) {
      const origin = _hitPoint.clone()
      ripples.push({ origin, radius: 0,    amp: RIPPLE_INITIAL_AMP })
      ripples.push({ origin, radius: 0.45, amp: RIPPLE_INITIAL_AMP * 0.75 })
      ripples.push({ origin, radius: 0.9,  amp: RIPPLE_INITIAL_AMP * 0.55 })
      ripples.push({ origin, radius: 1.35, amp: RIPPLE_INITIAL_AMP * 0.35 })
    }
  }

  element.addEventListener('pointerdown', onPointerDown)
  element.addEventListener('pointerup', onPointerUp)
  return () => {
    element.removeEventListener('pointerdown', onPointerDown)
    element.removeEventListener('pointerup', onPointerUp)
  }
}
