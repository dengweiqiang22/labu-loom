import type { CompanionMode } from './mode'

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface Rectangle extends Point, Size {}

export interface MovementPlanOptions {
  anchor: Point
  bounds: Rectangle
  locked: boolean
  mode: CompanionMode
  random?: () => number
  windowSize: Size
}

const MOVEMENT_RADIUS: Readonly<Record<CompanionMode, number>> = {
  quiet: 0,
  companion: 36,
  active: 72,
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(value, maximum))
}

export function planNearbyMovement(options: MovementPlanOptions): Point | undefined {
  const radius = MOVEMENT_RADIUS[options.mode]

  if (options.locked || radius === 0) return

  const random = options.random ?? Math.random
  const angle = random() * Math.PI * 2
  const distance = radius * (0.55 + random() * 0.45)
  const maxX = Math.max(options.bounds.x, options.bounds.x + options.bounds.width - options.windowSize.width)
  const maxY = Math.max(options.bounds.y, options.bounds.y + options.bounds.height - options.windowSize.height)

  return {
    x: Math.round(clamp(options.anchor.x + Math.cos(angle) * distance, options.bounds.x, maxX)),
    y: Math.round(clamp(options.anchor.y + Math.sin(angle) * distance, options.bounds.y, maxY)),
  }
}
