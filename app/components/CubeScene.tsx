'use client'
import { useEffect, useRef } from 'react'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GRID_ROWS, GRID_COLS, CUBE_SIZE, CUBE_COLOR, SHOW_HEMISPHERE_COLORS } from '@/lib/constants'
import * as THREE from 'three'
import { Cell } from './Cube'

const EXTRUDE           = 0.05
const SPHERE_RADIUS     = 5
const SPHERE_RADIUS_SQ  = 25
const WAVE_SPEED_SCALE  = 0.8
const WAVE_FRICTION     = 0.97
const WAVE_AMP_DECAY    = 0.94
const WAVE_INFLUENCE_SQ = 0.25
const SPRING_K          = 0.06
const SPRING_DAMPING    = 0.82
const MAX_PACKETS       = 12
const MIN_SPEED         = 0.003
const HOVER_RADIUS_SQ   = 0.12
const HOVER_MAX         = 0.25
const HOVER_LERP        = 0.18

interface WavePacket {
  pos: THREE.Vector3
  vel: THREE.Vector3
  amp: number
}

type VoxelState = [number, number]

function setupRenderer(container: HTMLDivElement) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
  const renderer = new THREE.WebGLRenderer()
  renderer.setSize(window.innerWidth, window.innerHeight)
  container.appendChild(renderer.domElement)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enablePan = false

  camera.position.z = 15
  scene.rotation.x = Math.PI

  return { scene, camera, renderer, controls }
}

async function buildGlobe(scene: THREE.Scene) {
  const grid: Cell[] = await fetch('/api/grid').then(r => r.json())
  const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE)
  const material = new THREE.MeshBasicMaterial({ color: CUBE_COLOR })
  const landCount = grid.filter((c: Cell) => c.elevated).length
  const mesh = new THREE.InstancedMesh(geometry, material, landCount)

  const positions: THREE.Vector3[] = []
  const baseColor = new THREE.Color(CUBE_COLOR)
  const matrix = new THREE.Matrix4()
  let i = 0
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const cell = grid[row * GRID_COLS + col]
      if (!cell.elevated) continue
      const lat = (row / GRID_ROWS) * Math.PI - Math.PI / 2
      const lng = (col / GRID_COLS) * Math.PI * 2 - Math.PI
      const x = SPHERE_RADIUS * Math.cos(lat) * Math.cos(lng)
      const y = SPHERE_RADIUS * Math.sin(lat)
      const z = SPHERE_RADIUS * Math.cos(lat) * Math.sin(lng)
      matrix.setPosition(x, y, z)
      mesh.setMatrixAt(i, matrix)
      mesh.setColorAt(i, baseColor)
      positions.push(new THREE.Vector3(x, y, z))
      i++
    }
  }
  scene.add(mesh)
  return { mesh, positions }
}

const blueColor = new THREE.Color(0x0044ff)
const baseColor  = new THREE.Color(CUBE_COLOR)

function updateHemisphereColors(
  mesh: THREE.InstancedMesh,
  positions: THREE.Vector3[],
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera
) {
  const localCamPos = scene.worldToLocal(camera.position.clone())
  for (let i = 0; i < positions.length; i++) {
    mesh.setColorAt(i, positions[i].dot(localCamPos) > SPHERE_RADIUS_SQ ? blueColor : baseColor)
  }
  mesh.instanceColor!.needsUpdate = true
}

const _invMat   = new THREE.Matrix4()
const _localCam = new THREE.Vector3()
const _normal   = new THREE.Vector3()
const _diff     = new THREE.Vector3()
const _voxelDir = new THREE.Vector3()
const _voxelPos = new THREE.Vector3()
const _voxelMat = new THREE.Matrix4()

function tickWaveSimulation(
  mesh: THREE.InstancedMesh,
  positions: THREE.Vector3[],
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  activeVoxels: Map<number, VoxelState>,
  packets: WavePacket[],
  hoverVoxels: Map<number, number>,
  cursorRef: { current: THREE.Vector3 | null }
) {
  if (packets.length === 0 && activeVoxels.size === 0 && hoverVoxels.size === 0) return

  _invMat.copy(scene.matrixWorld).invert()
  _localCam.copy(camera.position).applyMatrix4(_invMat)

  for (let pi = packets.length - 1; pi >= 0; pi--) {
    const p = packets[pi]

    p.pos.add(p.vel)
    p.pos.setLength(SPHERE_RADIUS)

    _normal.copy(p.pos).normalize()
    p.vel.addScaledVector(_normal, -p.vel.dot(_normal))
    p.vel.multiplyScalar(WAVE_FRICTION)
    p.amp *= WAVE_AMP_DECAY

    if (p.amp < 0.005) { packets.splice(pi, 1); continue }

    for (let i = 0; i < positions.length; i++) {
      if (positions[i].dot(_localCam) <= SPHERE_RADIUS_SQ) continue
      _diff.subVectors(positions[i], p.pos)
      const distSq = _diff.lengthSq()
      if (distSq >= WAVE_INFLUENCE_SQ) continue
      const impulse = p.amp * Math.exp(-distSq / (WAVE_INFLUENCE_SQ * 0.35))
      const s = activeVoxels.get(i)
      if (s) { s[1] = Math.min(s[1] + impulse, 0.3) } else { activeVoxels.set(i, [0, Math.min(impulse, 0.3)]) }
    }
  }

  for (const [id, s] of activeVoxels) {
    let [t, v] = s
    v -= t * SPRING_K
    v *= SPRING_DAMPING
    t += v

    _voxelDir.copy(positions[id]).normalize()
    _voxelPos.copy(positions[id]).addScaledVector(_voxelDir, EXTRUDE * Math.max(0, t))
    _voxelMat.setPosition(_voxelPos)
    mesh.setMatrixAt(id, _voxelMat)

    if (Math.abs(t) < 0.0005 && Math.abs(v) < 0.0005) {
      activeVoxels.delete(id)
      _voxelMat.setPosition(positions[id])
      mesh.setMatrixAt(id, _voxelMat)
    } else {
      s[0] = t; s[1] = v
    }
  }

  const cursor = cursorRef.current

  if (cursor) {
    for (let i = 0; i < positions.length; i++) {
      if (hoverVoxels.has(i)) continue
      if (positions[i].dot(_localCam) <= SPHERE_RADIUS_SQ) continue
      _diff.subVectors(positions[i], cursor)
      if (_diff.lengthSq() < HOVER_RADIUS_SQ) hoverVoxels.set(i, 0)
    }
  }

  for (const [id, ht] of hoverVoxels) {
    _diff.subVectors(positions[id], cursor ?? positions[id])
    const distSq = cursor ? _diff.lengthSq() : Infinity
    const target = (cursor && distSq < HOVER_RADIUS_SQ)
      ? HOVER_MAX * (1 - distSq / HOVER_RADIUS_SQ)
      : 0
    const newHt = ht + (target - ht) * HOVER_LERP
    const waveT = activeVoxels.get(id)?.[0] ?? 0

    _voxelDir.copy(positions[id]).normalize()
    _voxelPos.copy(positions[id]).addScaledVector(_voxelDir, EXTRUDE * (Math.max(0, waveT) + newHt))
    _voxelMat.setPosition(_voxelPos)
    mesh.setMatrixAt(id, _voxelMat)

    if (newHt < 0.0005 && target === 0) {
      hoverVoxels.delete(id)
    } else {
      hoverVoxels.set(id, newHt)
    }
  }

  mesh.instanceMatrix.needsUpdate = true
}

function raySphereHit(
  origin: THREE.Vector3, dir: THREE.Vector3, out: THREE.Vector3
): boolean {
  const b = 2 * origin.dot(dir)
  const c = origin.lengthSq() - SPHERE_RADIUS_SQ
  const disc = b * b - 4 * c
  if (disc < 0) return false
  const t = (-b - Math.sqrt(disc)) / 2
  if (t < 0) return false
  out.copy(origin).addScaledVector(dir, t)
  return true
}

function setupHover(
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  packets: WavePacket[],
  cursorRef: { current: THREE.Vector3 | null }
) {
  const raycaster   = new THREE.Raycaster()
  const mouse       = new THREE.Vector2()
  const prevMouse   = new THREE.Vector2()
  const invMat      = new THREE.Matrix4()
  const localOrigin = new THREE.Vector3()
  const localDir    = new THREE.Vector3()
  const hitPoint    = new THREE.Vector3()
  const prevHit     = new THREE.Vector3()
  let prevHitValid  = false

  const onMouseMove = (e: MouseEvent) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1

    const dx = mouse.x - prevMouse.x
    const dy = mouse.y - prevMouse.y
    const speed = Math.sqrt(dx * dx + dy * dy)
    prevMouse.copy(mouse)

    if (speed < MIN_SPEED) { prevHitValid = false; return }

    raycaster.setFromCamera(mouse, camera)
    invMat.copy(scene.matrixWorld).invert()
    localOrigin.copy(raycaster.ray.origin).applyMatrix4(invMat)
    localDir.copy(raycaster.ray.direction).transformDirection(invMat)

    if (!raySphereHit(localOrigin, localDir, hitPoint)) { prevHitValid = false; cursorRef.current = null; return }

    cursorRef.current = hitPoint.clone()

    if (prevHitValid && packets.length < MAX_PACKETS) {
      const vel = hitPoint.clone().sub(prevHit).multiplyScalar(WAVE_SPEED_SCALE)
      const n = hitPoint.clone().normalize()
      vel.addScaledVector(n, -vel.dot(n))
      packets.push({ pos: hitPoint.clone(), vel, amp: Math.min(1, speed * 10) })
    }

    prevHit.copy(hitPoint)
    prevHitValid = true
  }

  const onMouseLeave = () => { cursorRef.current = null }

  renderer.domElement.addEventListener('mousemove', onMouseMove)
  renderer.domElement.addEventListener('mouseleave', onMouseLeave)
  return () => {
    prevHitValid = false
    cursorRef.current = null
    renderer.domElement.removeEventListener('mousemove', onMouseMove)
    renderer.domElement.removeEventListener('mouseleave', onMouseLeave)
  }
}

function startAnimation(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  onFrame: () => void
) {
  let animId: number
  const animate = () => {
    animId = requestAnimationFrame(animate)
    onFrame()
    controls.update()
    renderer.render(scene, camera)
  }
  animate()
  return () => { cancelAnimationFrame(animId); renderer.dispose() }
}

export default function CubeScene() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const init = async () => {
      const { scene, camera, renderer, controls } = setupRenderer(ref.current!)
      const { mesh, positions } = await buildGlobe(scene)

      if (SHOW_HEMISPHERE_COLORS) updateHemisphereColors(mesh, positions, scene, camera)
      const onCameraChange = () => { if (SHOW_HEMISPHERE_COLORS) updateHemisphereColors(mesh, positions, scene, camera) }
      controls.addEventListener('change', onCameraChange)

      const activeVoxels = new Map<number, VoxelState>()
      const hoverVoxels  = new Map<number, number>()
      const packets: WavePacket[] = []
      const cursorRef: { current: THREE.Vector3 | null } = { current: null }

      const stopHover = setupHover(renderer, camera, scene, packets, cursorRef)
      const stopAnimation = startAnimation(renderer, scene, camera, controls, () =>
        tickWaveSimulation(mesh, positions, scene, camera, activeVoxels, packets, hoverVoxels, cursorRef)
      )

      return () => {
        controls.removeEventListener('change', onCameraChange)
        stopHover()
        stopAnimation()
      }
    }
    const cleanup = init()
    return () => { cleanup.then(fn => fn()) }
  }, [])

  return <div ref={ref} />
}
