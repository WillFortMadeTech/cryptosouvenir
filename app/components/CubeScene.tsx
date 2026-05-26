'use client'
import { useEffect, useRef } from 'react'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CUBE_SIZE, CUBE_COLOR, SHOW_HEMISPHERE_COLORS } from '@/lib/constants'
import * as THREE from 'three'
import { Cell } from './Cube'
import { type Ripple, tickRipples, setupRippleClick } from './ripple'
import { setupTypingEffect } from './typingEffect'
import { setupIndicator } from './indicator'
import { textScene, orthoCamera, updateOrthoAspect } from './textScene'

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
const VIGNETTE_START    = 11
const VIGNETTE_END      = 7
const HIGHLIGHT_ZOOM    = 8

const highlightColor = new THREE.Color().setHSL(Math.random(), 1.0, 0.55)

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
  const cells: Cell[] = await fetch('/api/grid').then(r => r.json())
  const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE)
  const material = new THREE.MeshBasicMaterial({ color: CUBE_COLOR })
  const mesh = new THREE.InstancedMesh(geometry, material, cells.length)

  const positions: THREE.Vector3[] = []
  const baseColor = new THREE.Color(CUBE_COLOR)
  const matrix = new THREE.Matrix4()
  for (let i = 0; i < cells.length; i++) {
    const { lat, lng } = cells[i]
    const x = SPHERE_RADIUS * Math.cos(lat) * Math.cos(lng)
    const y = SPHERE_RADIUS * Math.sin(lat)
    const z = SPHERE_RADIUS * Math.cos(lat) * Math.sin(lng)
    matrix.setPosition(x, y, z)
    mesh.setMatrixAt(i, matrix)
    mesh.setColorAt(i, baseColor)
    positions.push(new THREE.Vector3(x, y, z))
  }
  scene.add(mesh)
  return { mesh, positions, cells }
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
  cursorRef: { current: THREE.Vector3 | null },
  rippleVoxels: Map<number, VoxelState>
) {
  if (packets.length === 0 && activeVoxels.size === 0 && hoverVoxels.size === 0 && rippleVoxels.size === 0) return

  const dist = camera.position.length()
  const waveScale = Math.max(0, Math.min(1, (dist - VIGNETTE_END) / (VIGNETTE_START - VIGNETTE_END)))
  const effectiveExtrude = EXTRUDE * waveScale

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

  for (const [id, s] of rippleVoxels) {
    let [t, v] = s
    v -= t * SPRING_K
    v *= SPRING_DAMPING
    t += v
    if (Math.abs(t) < 0.0005 && Math.abs(v) < 0.0005) { rippleVoxels.delete(id) }
    else { s[0] = t; s[1] = v }
  }

  for (const [id, s] of activeVoxels) {
    let [t, v] = s
    v -= t * SPRING_K
    v *= SPRING_DAMPING
    t += v

    const rT = rippleVoxels.get(id)?.[0] ?? 0
    _voxelDir.copy(positions[id]).normalize()
    _voxelPos.copy(positions[id]).addScaledVector(_voxelDir, effectiveExtrude * Math.max(0, t) + EXTRUDE * Math.max(0, rT))
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

  for (const [id, s] of rippleVoxels) {
    if (activeVoxels.has(id) || hoverVoxels.has(id)) continue
    _voxelDir.copy(positions[id]).normalize()
    _voxelPos.copy(positions[id]).addScaledVector(_voxelDir, EXTRUDE * Math.max(0, s[0]))
    _voxelMat.setPosition(_voxelPos)
    mesh.setMatrixAt(id, _voxelMat)
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
    const rT    = rippleVoxels.get(id)?.[0] ?? 0

    _voxelDir.copy(positions[id]).normalize()
    _voxelPos.copy(positions[id]).addScaledVector(_voxelDir, effectiveExtrude * (Math.max(0, waveT) + newHt) + EXTRUDE * Math.max(0, rT))
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
  cursorRef: { current: THREE.Vector3 | null },
  onCursorChange: () => void
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

    if (!raySphereHit(localOrigin, localDir, hitPoint)) { prevHitValid = false; cursorRef.current = null; onCursorChange(); return }

    cursorRef.current = hitPoint.clone()
    onCursorChange()

    if (prevHitValid && packets.length < MAX_PACKETS) {
      const vel = hitPoint.clone().sub(prevHit).multiplyScalar(WAVE_SPEED_SCALE)
      const n = hitPoint.clone().normalize()
      vel.addScaledVector(n, -vel.dot(n))
      packets.push({ pos: hitPoint.clone(), vel, amp: Math.min(1, speed * 10) })
    }

    prevHit.copy(hitPoint)
    prevHitValid = true
  }

  const onMouseLeave = () => { cursorRef.current = null; onCursorChange() }

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
  onFrame: () => void,
  overlay?: { scene: THREE.Scene; camera: THREE.Camera }
) {
  renderer.autoClear = false
  let animId: number
  const animate = () => {
    animId = requestAnimationFrame(animate)
    onFrame()
    controls.update()
    renderer.clear()
    renderer.render(scene, camera)
    if (overlay) {
      renderer.clearDepth()
      renderer.render(overlay.scene, overlay.camera)
    }
  }
  animate()
  return () => { cancelAnimationFrame(animId); renderer.dispose() }
}

export default function CubeScene() {
  const ref         = useRef<HTMLDivElement>(null)
  const vignetteRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef       = useRef<HTMLImageElement>(null)
  const sigInfoRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const init = async () => {
      const { scene, camera, renderer, controls } = setupRenderer(ref.current!)
      const { mesh, positions, cells } = await buildGlobe(scene)

      const activeVoxels  = new Map<number, VoxelState>()
      const rippleVoxels  = new Map<number, VoxelState>()
      const hoverVoxels   = new Map<number, number>()
      const packets: WavePacket[] = []
      const ripples: Ripple[] = []
      const cursorRef: { current: THREE.Vector3 | null } = { current: null }
      const highlightRef = { current: -1 }

      const claimedColors = new Map<number, THREE.Color>()

      // Build cube_id → mesh index map for loading persisted colors
      const cubeIdToIndex = new Map<string, number>()
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i]
        cubeIdToIndex.set(`${c.lat.toFixed(6)}:${c.lng.toFixed(6)}`, i)
      }

      const getVoxelBaseColor = (id: number, localCam: THREE.Vector3) => {
        const claimed = claimedColors.get(id)
        if (claimed) return claimed
        if (SHOW_HEMISPHERE_COLORS && positions[id].dot(localCam) > SPHERE_RADIUS_SQ) return blueColor
        return baseColor
      }

      // Load persisted claimed cube colors from the database
      fetch('/api/cubes')
        .then(r => r.json())
        .then((items: { cube_id: string; color: string }[]) => {
          let changed = false
          for (const { cube_id, color } of items) {
            const idx = cubeIdToIndex.get(cube_id)
            if (idx === undefined) continue
            const c = new THREE.Color(color)
            claimedColors.set(idx, c)
            mesh.setColorAt(idx, c)
            changed = true
          }
          if (changed) mesh.instanceColor!.needsUpdate = true
        })
        .catch(() => { /* silent — colors just won't be pre-loaded */ })

      const updateHighlight = () => {
        const dist = camera.position.length()
        _invMat.copy(scene.matrixWorld).invert()
        _localCam.copy(camera.position).applyMatrix4(_invMat)

        if (dist >= HIGHLIGHT_ZOOM || !cursorRef.current) {
          if (highlightRef.current !== -1) {
            mesh.setColorAt(highlightRef.current, getVoxelBaseColor(highlightRef.current, _localCam))
            mesh.instanceColor!.needsUpdate = true
            highlightRef.current = -1
          }
          return
        }

        let minDistSq = Infinity
        let newId = -1
        for (let i = 0; i < positions.length; i++) {
          if (positions[i].dot(_localCam) <= SPHERE_RADIUS_SQ) continue
          _diff.subVectors(positions[i], cursorRef.current)
          const d = _diff.lengthSq()
          if (d < minDistSq) { minDistSq = d; newId = i }
        }

        if (newId === highlightRef.current) return

        if (highlightRef.current !== -1)
          mesh.setColorAt(highlightRef.current, getVoxelBaseColor(highlightRef.current, _localCam))
        if (newId !== -1)
          mesh.setColorAt(newId, highlightColor)

        highlightRef.current = newId
        mesh.instanceColor!.needsUpdate = true
      }

      const updateVignette = () => {
        if (!vignetteRef.current) return
        const dist = camera.position.length()
        const intensity = Math.max(0, Math.min(1, (VIGNETTE_START - dist) / (VIGNETTE_START - VIGNETTE_END)))
        vignetteRef.current.style.opacity = String(intensity * 0.7)
      }

      if (SHOW_HEMISPHERE_COLORS) updateHemisphereColors(mesh, positions, scene, camera)
      const onCameraChange = () => {
        if (SHOW_HEMISPHERE_COLORS) updateHemisphereColors(mesh, positions, scene, camera)
        updateVignette()
        updateHighlight()
      }
      controls.addEventListener('change', onCameraChange)

      updateOrthoAspect(window.innerWidth / window.innerHeight)

      const onResize = () => {
        const aspect = window.innerWidth / window.innerHeight
        renderer.setSize(window.innerWidth, window.innerHeight)
        camera.aspect = aspect
        camera.updateProjectionMatrix()
        updateOrthoAspect(aspect)
      }
      window.addEventListener('resize', onResize)

      // Camera panel animation — disabled controls while animating to avoid OrbitControls fighting lerp
      const PANEL_POS  = new THREE.Vector3(-3, 0, 20)
      const PANEL_LOOK = new THREE.Vector3(-7, 0, 0)
      // Direction the selected cube should face in world space: upper-middle from camera's view
      const PANEL_CUBE_DIR = PANEL_POS.clone().normalize().add(new THREE.Vector3(0, 1, 0)).normalize()
      const camAnim = {
        active: false,
        inPanel: false,
        targetPos:   new THREE.Vector3(0, 0, 15),
        targetLook:  new THREE.Vector3(0, 0, 0),
        targetQ:     scene.quaternion.clone(),
        savedPos:    new THREE.Vector3(0, 0, 15),
        savedTarget: new THREE.Vector3(0, 0, 0),
        savedQ:      new THREE.Quaternion(),
      }
      const selectedCubeRef = { current: -1 }

      const tickCameraAnim = () => {
        if (!camAnim.active) return
        camera.position.lerp(camAnim.targetPos, 0.06)
        controls.target.lerp(camAnim.targetLook, 0.06)
        camera.lookAt(controls.target)
        scene.quaternion.slerp(camAnim.targetQ, 0.06)
        updateVignette()
        updateHighlight()
        if (
          camera.position.distanceTo(camAnim.targetPos) < 0.02 &&
          controls.target.distanceTo(camAnim.targetLook) < 0.02
        ) {
          camera.position.copy(camAnim.targetPos)
          controls.target.copy(camAnim.targetLook)
          scene.quaternion.copy(camAnim.targetQ)
          camera.lookAt(controls.target)
          camAnim.active = false
          if (!camAnim.inPanel) {
            controls.enabled = true
          } else if (selectedCubeRef.current !== -1) {
            const pos = positions[selectedCubeRef.current]
            indicator.showLine(pos)
            indicator.startEmitting(pos)
            if (viewModeRef.current) {
              fetchAndShowSubmission(selectedCubeRef.current)
            } else {
              claimCube(selectedCubeRef.current)
            }
          }
        }
      }

      let downX = 0, downY = 0
      const onPointerDown = (e: PointerEvent) => { downX = e.clientX; downY = e.clientY }
      const onPointerUp = (e: PointerEvent) => {
        const dx = e.clientX - downX, dy = e.clientY - downY
        if (dx * dx + dy * dy > 25) return
        if (camAnim.inPanel || highlightRef.current === -1) return
        camAnim.savedPos.copy(camera.position)
        camAnim.savedTarget.copy(controls.target)
        camAnim.savedQ.copy(scene.quaternion)
        selectedCubeRef.current = highlightRef.current
        viewModeRef.current = claimedColors.has(highlightRef.current)
        const localDir = positions[highlightRef.current].clone().normalize()
        camAnim.targetQ.setFromUnitVectors(localDir, PANEL_CUBE_DIR)
        camAnim.inPanel = true
        controls.enabled = false
        setTimeout(() => {
          camAnim.active = true
          camAnim.targetPos.copy(PANEL_POS)
          camAnim.targetLook.copy(PANEL_LOOK)
        }, 150)
      }

      renderer.domElement.addEventListener('pointerdown', onPointerDown)
      renderer.domElement.addEventListener('pointerup', onPointerUp)

      const stopHover   = setupHover(renderer, camera, scene, packets, cursorRef, updateHighlight)
      const stopRipple  = setupRippleClick(renderer.domElement, camera, scene, ripples)
      const indicator   = setupIndicator(scene)

      const fileRef:  { current: File | null } = { current: null }
      const claimRef: { current: { token: string; color: string; cubeId: string; cubeIdx: number } | null } = { current: null }

      const claimCube = async (cubeIdx: number) => {
        const cell   = cells[cubeIdx]
        const cubeId = `${cell.lat.toFixed(6)}:${cell.lng.toFixed(6)}`
        try {
          const res = await fetch('/api/claim', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ cube_id: cubeId }),
          })
          if (!res.ok) return // cube already claimed — leave default color
          const { token, color } = await res.json()
          if (selectedCubeRef.current !== cubeIdx) return // user already backed out
          claimRef.current = { token, color, cubeId, cubeIdx }
          const c = new THREE.Color(color)
          mesh.setColorAt(cubeIdx, c)
          mesh.instanceColor!.needsUpdate = true
        } catch { /* silent — network error, color stays default */ }
      }

      const fetchAndShowSubmission = async (cubeIdx: number) => {
        const cell   = cells[cubeIdx]
        const cubeId = `${cell.lat.toFixed(6)}:${cell.lng.toFixed(6)}`
        try {
          const res = await fetch(`/api/submission?cube_id=${encodeURIComponent(cubeId)}`)
          if (!res.ok) return
          const { title, description, s3_key, timestamp, key_fingerprint, device_name } = await res.json()
          showInfo(title, description)
          if (imgRef.current && s3_key) {
            imgRef.current.src = `/api/image?key=${encodeURIComponent(s3_key)}`
            imgRef.current.style.display = 'block'
          }
          if (sigInfoRef.current) {
            const row = (label: string, value: string, mono = false) => {
              const wrap = document.createElement('div')
              wrap.style.marginTop = '8px'
              const lbl = document.createElement('div')
              lbl.textContent = label
              lbl.style.cssText = 'opacity:0.4;font-size:9px;letter-spacing:0.14em'
              const val = document.createElement('div')
              val.textContent = value
              if (mono) { val.style.fontFamily = '"Courier New",monospace'; val.style.wordBreak = 'break-all'; val.style.textTransform = 'none' }
              wrap.appendChild(lbl)
              wrap.appendChild(val)
              return wrap
            }
            sigInfoRef.current.replaceChildren()
            if (device_name)     sigInfoRef.current.appendChild(row('SIGNED WITH', device_name))
            if (key_fingerprint) sigInfoRef.current.appendChild(row('KEY FINGERPRINT', `SHA256:${key_fingerprint}`, true))
            if (timestamp)       sigInfoRef.current.appendChild(row('', new Date(timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })))
            sigInfoRef.current.style.display = 'block'
          }
        } catch { /* silent */ }
      }

      const handleSubmit = async (title: string, desc: string) => {
        if (!fileRef.current || !claimRef.current) return
        try {
          // Get a server-issued challenge
          const challengeRes = await fetch('/api/webauthn/challenge', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ cube_id: claimRef.current.cubeId }),
          })
          if (!challengeRes.ok) return
          const { challenge_id, challenge, rp_id, rp_name } = await challengeRes.json()

          // base64url ↔ ArrayBuffer helpers
          const fromB64url = (s: string) =>
            Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
          const toB64url = (buf: ArrayBuffer) =>
            btoa(String.fromCharCode(...new Uint8Array(buf)))
              .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

          // Run the WebAuthn signing ceremony via native browser API
          const cred = await navigator.credentials.create({
            publicKey: {
              challenge:   fromB64url(challenge),
              rp:          { id: rp_id, name: rp_name },
              user: {
                id:          new TextEncoder().encode(claimRef.current.cubeId),
                name:        claimRef.current.cubeId,
                displayName: 'CryptoSouvenir',
              },
              pubKeyCredParams: [
                { alg: -7,   type: 'public-key' },
                { alg: -257, type: 'public-key' },
              ],
              timeout:    60000,
              attestation: 'direct',
              authenticatorSelection: { userVerification: 'preferred' },
            },
          }) as PublicKeyCredential | null
          if (!cred) return

          const attResp = cred.response as AuthenticatorAttestationResponse
          const attestationJSON = {
            id:    cred.id,
            rawId: cred.id,
            response: {
              clientDataJSON:    toB64url(attResp.clientDataJSON),
              attestationObject: toB64url(attResp.attestationObject),
              transports:        attResp.getTransports?.() ?? [],
            },
            type: 'public-key',
            clientExtensionResults: cred.getClientExtensionResults(),
          }

          const form = new FormData()
          form.set('title', title)
          form.set('description', desc)
          form.set('image', fileRef.current)
          form.set('token', claimRef.current.token)
          form.set('challenge_id', challenge_id)
          form.set('attestation', JSON.stringify(attestationJSON))

          const res = await fetch('/api/submit', { method: 'POST', body: form })
          if (res.ok) {
            // Register in claimedColors BEFORE clearing claimRef so goBack doesn't revert it
            const { cubeIdx, color } = claimRef.current
            claimedColors.set(cubeIdx, new THREE.Color(color))
            claimRef.current = null
            goBackRef.current()
          }
        } catch (err) {
          console.error('Submit failed:', err)
        }
      }

      const goBackRef    = { current: () => {} }
      const viewModeRef  = { current: false }

      const { tick: tickTyping, cleanup: cleanupTyping, resetForm, setUploadFile, showInfo, hideInfo } = setupTypingEffect(
        () => camAnim.inPanel && !camAnim.active && !viewModeRef.current,
        () => goBackRef.current(),
        () => fileInputRef.current?.click(),
        handleSubmit,
      )

      const fileInput = fileInputRef.current!
      const handleFileChange = () => {
        const file = fileInput.files?.[0] ?? null
        fileRef.current = file
        setUploadFile(file?.name ?? '')
      }
      fileInput.addEventListener('change', handleFileChange)

      const goBack = () => {
        indicator.stopEmitting()
        indicator.hideLine()
        if (viewModeRef.current) {
          hideInfo()
          if (imgRef.current)    { imgRef.current.style.display = 'none'; imgRef.current.src = '' }
          if (sigInfoRef.current) sigInfoRef.current.style.display = 'none'
          viewModeRef.current = false
        } else {
          if (claimRef.current && selectedCubeRef.current !== -1) {
            _invMat.copy(scene.matrixWorld).invert()
            _localCam.copy(camera.position).applyMatrix4(_invMat)
            mesh.setColorAt(selectedCubeRef.current, getVoxelBaseColor(selectedCubeRef.current, _localCam))
            mesh.instanceColor!.needsUpdate = true
            claimRef.current = null
          }
          fileRef.current = null
          if (fileInput) fileInput.value = ''
          resetForm()
        }
        camAnim.inPanel = false
        camAnim.active  = true
        camAnim.targetPos.copy(camAnim.savedPos)
        camAnim.targetLook.copy(camAnim.savedTarget)
        camAnim.targetQ.copy(camAnim.savedQ)
        selectedCubeRef.current = -1
      }
      goBackRef.current = goBack

      const stopAnimation = startAnimation(renderer, scene, camera, controls, () => {
        tickCameraAnim()
        tickTyping()
        indicator.tick()
        tickRipples(ripples, positions, rippleVoxels, camera, scene)
        tickWaveSimulation(mesh, positions, scene, camera, activeVoxels, packets, hoverVoxels, cursorRef, rippleVoxels)
      }, { scene: textScene, camera: orthoCamera })

      return () => {
        window.removeEventListener('resize', onResize)
        controls.removeEventListener('change', onCameraChange)
        renderer.domElement.removeEventListener('pointerdown', onPointerDown)
        renderer.domElement.removeEventListener('pointerup', onPointerUp)
        fileInput.removeEventListener('change', handleFileChange)
        stopHover()
        stopRipple()
        cleanupTyping()
        indicator.cleanup()
        stopAnimation()
      }
    }
    const cleanup = init()
    return () => { cleanup.then(fn => fn()) }
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      <div ref={ref} />
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} />
      <img ref={imgRef} alt="" style={{
        display: 'none',
        position: 'absolute',
        bottom: '8%',
        left: '8%',
        width: '28%',
        maxHeight: '35%',
        objectFit: 'contain',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 2,
      }} />
      <div ref={sigInfoRef} style={{
        display: 'none',
        position: 'absolute',
        bottom: '8%',
        right: '5%',
        fontFamily: '"Courier New", monospace',
        fontSize: '10px',
        color: 'rgba(255,255,255,0.75)',
        textAlign: 'right',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        lineHeight: 1.5,
        pointerEvents: 'none',
      }} />
      <div ref={vignetteRef} style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 20%, black 75%)',
        opacity: 0,
        transition: 'opacity 0.15s ease',
      }} />
    </div>
  )
}
