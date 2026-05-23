import * as THREE from 'three';

export type Cell = { elevated: boolean; color: number };

export function createCube(cell: Cell, col: number, row:number): THREE.Mesh {
	const cube = new THREE.Mesh(
		new THREE.BoxGeometry(),
		new THREE.MeshBasicMaterial({ color: cell.color })
	);

	cube.position.x = (col -1) * 2.5;
	cube.position.y = (row -1) * 2.5;
	cube.position.z = cell.elevated ? 1 : 0; 
	return cube;
}

