import * as THREE from 'three'
import { textScene } from './textScene'

const FONT: Record<string, readonly number[]> = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10011, 0b10001, 0b10001, 0b01110],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b11111],
  J: [0b00001, 0b00001, 0b00001, 0b00001, 0b00001, 0b10001, 0b01110],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10001, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  '0': [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b11111],
  '2': [0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111],
  '3': [0b01110, 0b10001, 0b00001, 0b00110, 0b00001, 0b10001, 0b01110],
  '4': [0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010, 0b00010],
  '5': [0b11111, 0b10000, 0b10000, 0b11110, 0b00001, 0b00001, 0b11110],
  '6': [0b01110, 0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  '7': [0b11111, 0b00001, 0b00010, 0b00100, 0b00100, 0b00100, 0b00100],
  '8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  '9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b10001, 0b01110],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0, 0b00100],
  ',': [0, 0, 0, 0, 0, 0b00100, 0b01000],
  '!': [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0, 0b00100],
  '?': [0b01110, 0b10001, 0b00001, 0b00110, 0b00100, 0, 0b00100],
  '-': [0, 0, 0, 0b11111, 0, 0, 0],
  '[': [0b11110, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11110],
  ']': [0b01111, 0b00001, 0b00001, 0b00001, 0b00001, 0b00001, 0b01111],
  '+': [0, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0],
}

// Ortho space: height = 2 units (+1 top, -1 bottom), width = 2 * aspect.
// PIXEL_STEP drives all sizing — 7 rows * PIXEL_STEP = character height.
// At 0.008, a character is 2.8% of screen height (~30px on 1080p).
const PIXEL_STEP  = 0.008
const PIXEL_SIZE  = PIXEL_STEP * 0.75
const CHAR_STRIDE = 7 * PIXEL_STEP   // 5 columns + 2 column gap

// Form left edge as a fraction of the half-width (multiply by aspect to get ortho x).
// -0.85 means 15% inset from the left edge of the ortho frustum.
const FORM_LEFT_FRAC = -0.85

const LABEL_COLOR  = 0x555555
const INPUT_COLOR  = 0xffffff
const UPLOAD_COLOR = 0x2a2a2a

const CHAR_HEIGHT = 7 * PIXEL_STEP

interface LayoutConfig { label: string; labelY: number; inputY: number; isUpload?: boolean }
const FORM_LAYOUT: LayoutConfig[] = [
  { label: 'TITLE',       labelY:  0.65, inputY:  0.52 },
  { label: 'DESCRIPTION', labelY:  0.30, inputY:  0.17 },
  { label: 'IMAGE',       labelY: -0.08, inputY: -0.21, isUpload: true },
]

const FLY_SPEED  = 0.06
const FADE_SPEED = 0.10

function easeOut(t: number) { return 1 - (1 - t) ** 3 }

// xFromLeft: cube's x offset from formLeft(). Recomputed on resize.
// y: fixed vertical position, never changes.
interface CubeData {
  mesh: THREE.Mesh
  target: THREE.Vector3
  origin: THREE.Vector3
  progress: number
  xFromLeft: number
}

interface CharGroup {
  cubes: CubeData[]
  material: THREE.MeshBasicMaterial
  dissolving: boolean
  opacity: number
}

interface FormField {
  labelY: number
  inputY: number
  isUpload: boolean
  labelGroups: CharGroup[]
  inputGroups: CharGroup[]
}

export function setupTypingEffect(
  isPanelReady: () => boolean
): { tick: () => void; cleanup: () => void } {
  const geometry   = new THREE.BoxGeometry(PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE)
  const fields: FormField[]   = []
  const dissolving: CharGroup[] = []
  let activeIdx   = 0
  let initialized = false
  let cursorMesh: THREE.Mesh | null = null
  let cursorMat: THREE.MeshBasicMaterial | null = null
  let cursorTick  = 0

  const aspect   = () => window.innerWidth / window.innerHeight
  const formLeft = () => aspect() * FORM_LEFT_FRAC

  // xOffset: distance from formLeft to the start of this text block.
  // All cube x positions = formLeft() + xOffset + ci*CHAR_STRIDE + col*PIXEL_STEP.
  function makeGroup(
    text: string,
    xOffset: number,
    topY: number,
    color: number,
    flyIn: boolean
  ): CharGroup {
    const mat  = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
    const cubes: CubeData[] = []
    const fl   = formLeft()
    const asp  = aspect()

    for (let ci = 0; ci < text.length; ci++) {
      const bitmap = FONT[text[ci].toUpperCase()] ?? FONT[' ']
      for (let row = 0; row < 7; row++) {
        const bits = bitmap[row] ?? 0
        for (let col = 0; col < 5; col++) {
          if (!(bits & (1 << (4 - col)))) continue

          const xFromLeft = xOffset + ci * CHAR_STRIDE + col * PIXEL_STEP
          const target = new THREE.Vector3(fl + xFromLeft, topY - row * PIXEL_STEP, 0)
          const origin = flyIn
            ? new THREE.Vector3(-asp + Math.random() * asp, (Math.random() - 0.5) * 2, 0)
            : target.clone()
          const mesh = new THREE.Mesh(geometry, mat)
          mesh.position.copy(origin)
          textScene.add(mesh)
          cubes.push({ mesh, target, origin, progress: flyIn ? 0 : 1, xFromLeft })
        }
      }
    }
    return { cubes, material: mat, dissolving: false, opacity: 1 }
  }

  function initForm() {
    for (const cfg of FORM_LAYOUT) {
      const field: FormField = {
        labelY:      cfg.labelY,
        inputY:      cfg.inputY,
        isUpload:    !!cfg.isUpload,
        labelGroups: [],
        inputGroups: [],
      }
      field.labelGroups.push(makeGroup(cfg.label, 0, cfg.labelY, LABEL_COLOR, true))
      if (cfg.isUpload) {
        field.labelGroups.push(makeGroup('[ + UPLOAD ]', 0, cfg.inputY, UPLOAD_COLOR, false))
      }
      fields.push(field)
    }

    cursorMat  = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 })
    cursorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(PIXEL_SIZE, CHAR_HEIGHT, PIXEL_SIZE),
      cursorMat
    )
    textScene.add(cursorMesh)
    moveCursor()
  }

  function moveCursor() {
    if (!cursorMesh) return
    const field = fields[activeIdx]
    if (!field || field.isUpload) { cursorMesh.visible = false; return }
    const fl = formLeft()
    cursorMesh.visible = true
    cursorMesh.position.set(
      fl + field.inputGroups.length * CHAR_STRIDE + PIXEL_STEP * 0.5,
      field.inputY - CHAR_HEIGHT / 2,
      0
    )
  }

  // Recompute all cube targets when the window resizes.
  function onResize() {
    const fl = formLeft()
    for (const f of fields) {
      for (const g of [...f.labelGroups, ...f.inputGroups]) {
        for (const c of g.cubes) {
          c.target.x = fl + c.xFromLeft
          if (c.progress >= 1) {
            // Already at rest — snap to new position
            c.mesh.position.x = c.target.x
          } else {
            // Still flying — update origin to current position so lerp is smooth
            c.origin.copy(c.mesh.position)
            c.progress = 0
          }
        }
      }
    }
    moveCursor()
  }

  window.addEventListener('resize', onResize)

  const onKeyDown = (e: KeyboardEvent) => {
    if (!isPanelReady()) return

    if (e.key === 'Tab') {
      e.preventDefault()
      activeIdx = (activeIdx + (e.shiftKey ? fields.length - 1 : 1)) % fields.length
      moveCursor()
      return
    }

    const field = fields[activeIdx]
    if (!field || field.isUpload) return

    if (e.key === 'Backspace') {
      e.preventDefault()
      if (field.inputGroups.length === 0) return
      const last = field.inputGroups.pop()!
      last.dissolving = true
      dissolving.push(last)
      moveCursor()
      return
    }

    if (e.key.length !== 1) return
    e.preventDefault()

    const idx = field.inputGroups.length
    field.inputGroups.push(makeGroup(e.key, idx * CHAR_STRIDE, field.inputY, INPUT_COLOR, true))
    moveCursor()
  }

  window.addEventListener('keydown', onKeyDown)

  function tickGroup(g: CharGroup) {
    for (const c of g.cubes) {
      if (c.progress < 1) {
        c.progress = Math.min(1, c.progress + FLY_SPEED)
        c.mesh.position.lerpVectors(c.origin, c.target, easeOut(c.progress))
      }
    }
  }

  function tick() {
    if (isPanelReady() && !initialized) { initForm(); initialized = true }

    for (const f of fields) {
      for (const g of f.labelGroups) tickGroup(g)
      for (const g of f.inputGroups) tickGroup(g)
    }

    for (let i = dissolving.length - 1; i >= 0; i--) {
      const g = dissolving[i]
      g.opacity -= FADE_SPEED
      if (g.opacity <= 0) {
        for (const c of g.cubes) textScene.remove(c.mesh)
        g.material.dispose()
        dissolving.splice(i, 1)
      } else {
        g.material.opacity = g.opacity
      }
    }

    cursorTick++
    if (cursorMat && cursorMesh?.visible) {
      cursorMat.opacity = cursorTick % 60 < 30 ? 1 : 0
    }
  }

  function cleanup() {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('resize', onResize)
    for (const f of fields) {
      for (const g of [...f.labelGroups, ...f.inputGroups]) {
        for (const c of g.cubes) textScene.remove(c.mesh)
        g.material.dispose()
      }
    }
    for (const g of dissolving) {
      for (const c of g.cubes) textScene.remove(c.mesh)
      g.material.dispose()
    }
    if (cursorMesh) { textScene.remove(cursorMesh); cursorMesh.geometry.dispose() }
    if (cursorMat) cursorMat.dispose()
    fields.length = 0
    dissolving.length = 0
    initialized = false
    geometry.dispose()
  }

  return { tick, cleanup }
}
