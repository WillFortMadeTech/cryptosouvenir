import sharp from 'sharp';
import path from 'path';
import { GRID_ROWS, GRID_COLS } from '@/lib/constants';


export const dynamic = 'force-static';

export async function GET() { 
	const imgPath = path.join(process.cwd(), 'public', 'WorldMap.png');
	const { data, info } = await sharp(imgPath).raw().toBuffer({ resolveWithObject: true });


	const cells = []


	for (let row = 0; row < GRID_ROWS; row++){
		for (let col = 0; col < GRID_COLS; col++){
			const x = Math.floor((col / GRID_COLS) * info.width);
			const y = Math.floor((row / GRID_ROWS) * info.height);
			const i = (y * info.width + x) * info.channels;
			const isLand = data[i + 3] > 128

			cells.push({ elevated: isLand, color: isLand ? 0x22cc88 : null })
		}
	}
	return Response.json(cells)

}
