import sharp from 'sharp';
import path from 'path';
import { GRID_ROWS, GRID_COLS } from '@/lib/constants';

export const dynamic = 'force-static';

export async function GET() {
	const imgPath = path.join(process.cwd(), 'public', 'WorldMap.png');
	const { data, info } = await sharp(imgPath).raw().toBuffer({ resolveWithObject: true });

	const cells = []

	for (let row = 0; row < GRID_ROWS; row++) {
		const lat = (row / GRID_ROWS) * Math.PI - Math.PI / 2
		const effectiveCols = Math.max(1, Math.round(GRID_COLS * Math.cos(lat)))
		for (let col = 0; col < effectiveCols; col++) {
			const lng = (col / effectiveCols) * Math.PI * 2 - Math.PI
			const imgX = Math.floor((col / effectiveCols) * info.width)
			const imgY = Math.floor((row / GRID_ROWS) * info.height)
			const i = (imgY * info.width + imgX) * info.channels
			if (data[i] < 128) {
				cells.push({ lat, lng })
			}
		}
	}
	return Response.json(cells)
}
