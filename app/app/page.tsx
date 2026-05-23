'use client'

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Home() {
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
		const renderer = new THREE.WebGLRenderer();
		renderer.setSize(window.innerWidth, window.innerHeight);
		ref.current!.appendChild(renderer.domElement);

		const cube = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
		scene.add(cube);
		camera.position.z = 5;

		const animate = () => {
			requestAnimationFrame(animate);
			cube.rotation.x += 0.01;
			renderer.render(scene, camera);

		}
		animate()

	}, []);
	return <div ref={ref} />
}
