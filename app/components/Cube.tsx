import * as THREE from 'three';

export type Cell = { lat: number; lng: number };

export function createCube(cell: Cell): THREE.Mesh {
	const cube = new THREE.Mesh(
		new THREE.BoxGeometry(0.02, 0.02, 0.02),
		new THREE.MeshBasicMaterial({ color: 0xffffff })
	);
	const radius = 5
	cube.position.x = radius * Math.cos(cell.lat) * Math.cos(cell.lng)
	cube.position.y = radius * Math.sin(cell.lat)
	cube.position.z = radius * Math.cos(cell.lat) * Math.sin(cell.lng)
	return cube;
}

