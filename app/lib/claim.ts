import { createHmac } from 'crypto'

const SECRET  = process.env.CLAIM_SECRET ?? 'dev-secret-change-me'
const TTL_MS  = 2 * 60 * 60 * 1000 // 2 hours

export const PALETTE = [
  '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#00C7BE', '#32ADE6',
  '#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#FF6B6B', '#FFE66D',
  '#4ECDC4', '#45B7D1', '#96CEB4', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#82E0AA', '#F1948A', '#F39C12', '#1ABC9C',
]

export function randomColor(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)]
}

export function signClaim(cubeId: string, color: string, exp: number): string {
  const payload = `${cubeId}|${color}|${exp}`
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex')
  return `${Buffer.from(payload).toString('base64url')}.${sig}`
}

export function verifyClaim(token: string): { cubeId: string; color: string } | null {
  const dot = token.lastIndexOf('.')
  if (dot === -1) return null
  const payloadB64 = token.slice(0, dot)
  const sig        = token.slice(dot + 1)
  const payload    = Buffer.from(payloadB64, 'base64url').toString()
  const expected   = createHmac('sha256', SECRET).update(payload).digest('hex')
  if (sig !== expected) return null
  const parts = payload.split('|')
  if (parts.length !== 3) return null
  const [cubeId, color, expStr] = parts
  if (Date.now() > Number(expStr)) return null
  return { cubeId, color }
}

export function makeClaim(cubeId: string, color: string): string {
  return signClaim(cubeId, color, Date.now() + TTL_MS)
}
