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

  const matrix = new THREE.Matrix4()
  let i = 0
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const cell = grid[row * GRID_COLS + col]
      if (!cell.elevated) continue
      const lat = (row / GRID_ROWS) * Math.PI - Math.PI / 2
      const lng = (col / GRID_COLS) * Math.PI * 2 - Math.PI
      const radius = 5
      matrix.setPosition(
        radius * Math.cos(lat) * Math.cos(lng),
        radius * Math.sin(lat),
        radius * Math.cos(lat) * Math.sin(lng)
      )
      mesh.setMatrixAt(i++, matrix)
    }
  }
  scene.add(mesh)
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
      await buildGlobe(scene)
      return startAnimation(renderer, scene, camera, controls)
    }
    const cleanup = init()
    return () => { cleanup.then(fn => fn()) }
  }, [])

  return <div ref={ref} />
}
