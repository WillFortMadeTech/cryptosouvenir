'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createCube, Cell } from './Cube';

export default function Page() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer()
    renderer.setSize(window.innerWidth, window.innerHeight)
    ref.current!.appendChild(renderer.domElement)

    const ROWS = 3;
    const COLS = 3;
    const grid: Cell[] = [
	{ elevated: false, color: 0xffffff },	
	{ elevated: false, color: 0xffffff },	
	{ elevated: false, color: 0xffffff },	
	{ elevated: false, color: 0xffffff },	
	{ elevated: true, color: 0xffffff },	
	{ elevated: false, color: 0x00ffff },	
	{ elevated: false, color: 0xffffff },	
	{ elevated: true, color: 0xffffff },	
	{ elevated: false, color: 0xffffff },	

    ]

   const cubes: THREE.Mesh[] = []

   for (let row = 0; row < ROWS; row++){
	for (let col = 0; col < COLS; col++){
		const cube = createCube(grid[row * COLS + col], col, row)
		scene.add(cube)
		cubes.push(cube)
	}
   }


    camera.position.z = 10

    let animId: number
    const animate = () => {
      animId = requestAnimationFrame(animate)
      cubes.forEach(cube => cube.rotation.x += 0.01)
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animId)
      renderer.dispose()
    }
  }, [])

  return <div ref={ref} />
}


