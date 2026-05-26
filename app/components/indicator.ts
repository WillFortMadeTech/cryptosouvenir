import * as THREE from 'three'

const LINE_CUBE_SIZE = 0.018
const LINE_SPACING   = 0.09
const LINE_HEIGHT    = 4.0   // units above the selected cube the line extends

const BURST_COUNT     = 18
const BURST_CUBE_SIZE = 0.08
const BURST_SPEED     = 0.06
const BURST_DRAG      = 0.93   // velocity multiplier per frame
const BURST_FADE      = 0.014  // opacity decrease per frame (~70 frames to fade)
const EMIT_INTERVAL   = 60     // frames between repeated bursts (~1s at 60fps)

interface BurstGroup {
  material: THREE.MeshBasicMaterial
  cubes: Array<{ mesh: THREE.Mesh; vel: THREE.Vector3 }>
  opacity: number
}

export function setupIndicator(scene: THREE.Scene) {
  const lineGeo  = new THREE.BoxGeometry(LINE_CUBE_SIZE, LINE_CUBE_SIZE, LINE_CUBE_SIZE)
  const lineMat  = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const burstGeo = new THREE.BoxGeometry(BURST_CUBE_SIZE, BURST_CUBE_SIZE, BURST_CUBE_SIZE)

  const lineMeshes: THREE.Mesh[] = []
  const bursts: BurstGroup[]     = []
  let emitPos:   THREE.Vector3 | null = null
  let emitTimer  = 0

  // cubeLocalPos: the selected cube's position in scene-local space.
  // The line goes upward in world-Y from that cube, expressed in scene-local coords.
  function showLine(cubeLocalPos: THREE.Vector3) {
    hideLine()

    // Convert world +Y into scene-local space so the line appears vertically on screen
    const sceneLocalUp = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(scene.quaternion.clone().invert())

    const steps = Math.ceil(LINE_HEIGHT / LINE_SPACING)
    for (let i = 0; i <= steps; i++) {
      const mesh = new THREE.Mesh(lineGeo, lineMat)
      mesh.position
        .copy(cubeLocalPos)
        .addScaledVector(sceneLocalUp, i * LINE_SPACING)
      scene.add(mesh)
      lineMeshes.push(mesh)
    }
  }

  function hideLine() {
    for (const m of lineMeshes) scene.remove(m)
    lineMeshes.length = 0
  }

  // Burst cubes fly outward in the sphere's tangent plane at cubeLocalPos.
  function showBurst(cubeLocalPos: THREE.Vector3) {
    const normal = cubeLocalPos.clone().normalize()
    const ref    = Math.abs(normal.y) < 0.99
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0)
    const t1 = ref.clone().sub(normal.clone().multiplyScalar(ref.dot(normal))).normalize()
    const t2 = normal.clone().cross(t1).normalize()

    const mat  = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 1 })
    const cubes: BurstGroup['cubes'] = []

    for (let i = 0; i < BURST_COUNT; i++) {
      const angle = (i / BURST_COUNT) * Math.PI * 2
      const dir   = t1.clone().multiplyScalar(Math.cos(angle))
                              .addScaledVector(t2, Math.sin(angle))
      const mesh  = new THREE.Mesh(burstGeo, mat)
      mesh.position.copy(cubeLocalPos)
      scene.add(mesh)
      cubes.push({ mesh, vel: dir.multiplyScalar(BURST_SPEED) })
    }

    bursts.push({ material: mat, cubes, opacity: 1 })
  }

  function startEmitting(cubeLocalPos: THREE.Vector3) {
    emitPos   = cubeLocalPos.clone()
    emitTimer = 0
    showBurst(cubeLocalPos)
  }

  function stopEmitting() {
    emitPos = null
  }

  function tick() {
    if (emitPos) {
      emitTimer++
      if (emitTimer >= EMIT_INTERVAL) {
        showBurst(emitPos)
        emitTimer = 0
      }
    }

    for (let i = bursts.length - 1; i >= 0; i--) {
      const b  = bursts[i]
      b.opacity -= BURST_FADE
      if (b.opacity <= 0) {
        for (const c of b.cubes) scene.remove(c.mesh)
        b.material.dispose()
        bursts.splice(i, 1)
      } else {
        b.material.opacity = b.opacity
        for (const c of b.cubes) {
          c.mesh.position.add(c.vel)
          c.vel.multiplyScalar(BURST_DRAG)
        }
      }
    }
  }

  function cleanup() {
    emitPos = null
    hideLine()
    for (const b of bursts) {
      for (const c of b.cubes) scene.remove(c.mesh)
      b.material.dispose()
    }
    bursts.length = 0
    lineGeo.dispose()
    lineMat.dispose()
    burstGeo.dispose()
  }

  return { showLine, showBurst, startEmitting, stopEmitting, hideLine, tick, cleanup }
}
