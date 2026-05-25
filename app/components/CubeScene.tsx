'use client'
import { useEffect, useRef } from 'react'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GRID_ROWS, GRID_COLS, CUBE_SIZE, CUBE_COLOR } from '@/lib/constants'
import * as THREE from 'three'
import { Cell } from './Cube'

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
      const radius = 5
      const x = radius * Math.cos(lat) * Math.cos(lng)
      const y = radius * Math.sin(lat)
      const z = radius * Math.cos(lat) * Math.sin(lng)
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
const baseColor = new THREE.Color(CUBE_COLOR)

function updateHemisphereColors(
  mesh: THREE.InstancedMesh,
  positions: THREE.Vector3[],
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera
) {
  const localCamPos = scene.worldToLocal(camera.position.clone())
  for (let i = 0; i < positions.length; i++) {
    mesh.setColorAt(i, positions[i].dot(localCamPos) > 25 ? blueColor : baseColor)
  }
  mesh.instanceColor!.needsUpdate = true
}

function startAnimation(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls
) {
  let animId: number
  const animate = () => {
    animId = requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
  }
  animate()
  return () => {
    cancelAnimationFrame(animId)
    renderer.dispose()
  }
}

export default function CubeScene() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const init = async () => {
      const { scene, camera, renderer, controls } = setupRenderer(ref.current!)
      const { mesh, positions } = await buildGlobe(scene)

      updateHemisphereColors(mesh, positions, scene, camera)
      const onCameraChange = () => updateHemisphereColors(mesh, positions, scene, camera)
      controls.addEventListener('change', onCameraChange)

      const stopAnimation = startAnimation(renderer, scene, camera, controls)
      return () => {
        controls.removeEventListener('change', onCameraChange)
        stopAnimation()
      }
    }
    const cleanup = init()
    return () => { cleanup.then(fn => fn()) }
  }, [])

  return <div ref={ref} />
}
