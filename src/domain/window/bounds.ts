export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface Rectangle extends Point, Size {}

export interface MonitorBounds {
  position: Point
  size: Size
  workArea?: {
    position: Point
    size: Size
  }
}

function isFiniteRectangle(rectangle: Rectangle) {
  return Number.isFinite(rectangle.x)
    && Number.isFinite(rectangle.y)
    && Number.isFinite(rectangle.width)
    && Number.isFinite(rectangle.height)
}

export function getVisibleBounds(monitor: MonitorBounds): Rectangle {
  if (monitor.workArea) {
    const workArea = {
      x: monitor.workArea.position.x,
      y: monitor.workArea.position.y,
      width: monitor.workArea.size.width,
      height: monitor.workArea.size.height,
    }

    if (isFiniteRectangle(workArea)) return workArea
  }

  return {
    x: monitor.position.x,
    y: monitor.position.y,
    width: monitor.size.width,
    height: monitor.size.height,
  }
}

export function containsPoint(point: Point, bounds: Rectangle) {
  return point.x >= bounds.x
    && point.x < bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y < bounds.y + bounds.height
}

export function findMonitorForPoint<T extends MonitorBounds>(
  monitors: readonly T[],
  point: Point,
) {
  return monitors.find(monitor => containsPoint(point, {
    x: monitor.position.x,
    y: monitor.position.y,
    width: monitor.size.width,
    height: monitor.size.height,
  }))
}

export function clampWindowPosition(
  position: Point,
  windowSize: Size,
  bounds: Rectangle,
): Point {
  const maxX = Math.max(bounds.x, bounds.x + bounds.width - windowSize.width)
  const maxY = Math.max(bounds.y, bounds.y + bounds.height - windowSize.height)

  return {
    x: Math.max(bounds.x, Math.min(position.x, maxX)),
    y: Math.max(bounds.y, Math.min(position.y, maxY)),
  }
}

export function resolveRestoredWindowPosition(
  saved: Point,
  windowSize: Size,
  monitors: readonly MonitorBounds[],
): Point | undefined {
  if (monitors.length === 0) return

  const matched = findMonitorForPoint(monitors, saved)

  if (matched) {
    return clampWindowPosition(saved, windowSize, getVisibleBounds(matched))
  }

  const fallback = monitors[0]
  const bounds = getVisibleBounds(fallback)

  return clampWindowPosition({
    x: bounds.x + Math.round((bounds.width - windowSize.width) / 2),
    y: bounds.y + Math.round((bounds.height - windowSize.height) / 2),
  }, windowSize, bounds)
}
