import type { Monitor, PhysicalPosition } from '@tauri-apps/api/window'

import { cursorPosition, monitorFromPoint } from '@tauri-apps/api/window'

let cachedMonitor: Monitor | null = null

export function invalidateCursorMonitorCache() {
  cachedMonitor = null
}

export async function getCursorMonitor(cursorPoint?: PhysicalPosition) {
  cursorPoint ??= await cursorPosition()

  if (cachedMonitor) {
    const { size, position } = cachedMonitor

    const inBounds = cursorPoint.x >= position.x
      && cursorPoint.x < position.x + size.width
      && cursorPoint.y >= position.y
      && cursorPoint.y < position.y + size.height

    if (inBounds) {
      return cachedMonitor
    }
  }

  // monitorFromPoint expects physical coordinates; do not convert through logical DPI.
  cachedMonitor = await monitorFromPoint(cursorPoint.x, cursorPoint.y)

  return cachedMonitor
}
