'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function Page() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer()
    renderer.setSize(window.innerWidth, window.innerHeight)
    ref.current!.appendChild(renderer.domElement)

    const cubes: THREE.Mesh[] = []

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const cube = new THREE.Mesh(
          new THREE.BoxGeometry(),
          new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        )
        cube.position.x = (col - 1) * 2.5
        cube.position.y = (row - 1) * 2.5
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


