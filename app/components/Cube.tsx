import * as THREE from 'three';

export type Cell = { elevated: boolean; color: number | null };

export function createCube(cell: Cell, lat: number, lng:number): THREE.Mesh {
	const cube = new THREE.Mesh(
		new THREE.BoxGeometry(0.02,0.02,0.02
		),
		new THREE.MeshBasicMaterial({ color: cell.color })
	);

	const radius = 5

	cube.position.x = radius * Math.cos(lat) * Math.cos(lng)
	cube.position.y = radius * Math.sin(lat)
	cube.position.z = radius * Math.cos(lat) * Math.sin(lng)
	return cube;
}

