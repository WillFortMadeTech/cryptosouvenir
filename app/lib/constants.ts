export const GRID_ROWS               = parseInt(process.env.NEXT_PUBLIC_GRID_ROWS               ?? '400')
export const GRID_COLS               = parseInt(process.env.NEXT_PUBLIC_GRID_COLS               ?? '800')
export const CUBE_SIZE               = parseFloat(process.env.NEXT_PUBLIC_CUBE_SIZE              ?? '0.01')
export const CUBE_COLOR              = Number(process.env.NEXT_PUBLIC_CUBE_COLOR                 ?? '0xffffff')
export const SHOW_HEMISPHERE_COLORS  = process.env.NEXT_PUBLIC_SHOW_HEMISPHERE_COLORS            === 'true'
