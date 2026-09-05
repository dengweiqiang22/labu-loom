import type { MotionInfo } from 'easy-live2d'

export const DEFAULT_WORK_HINT_THRESHOLD_MS = 25 * 60_000

const REST_MOTION_PATTERN = /yawn|stretch|rest|sleep|tired|哈欠|伸懒腰|趴|休息|困/i

export function shouldOfferWorkHint(input: {
  continuousActiveForMs?: number
  allowProactiveBehavior: boolean
  thresholdMs?: number
}) {
  const thresholdMs = input.thresholdMs ?? DEFAULT_WORK_HINT_THRESHOLD_MS

  return input.allowProactiveBehavior
    && (input.continuousActiveForMs ?? 0) >= thresholdMs
}

export function pickWorkHintMotion(
  motionGroups: ReadonlyArray<readonly [string, readonly MotionInfo[]]>,
) {
  for (const [groupName, motions] of motionGroups) {
    for (const motion of motions) {
      const label = `${motion.name ?? ''} ${groupName}`

      if (REST_MOTION_PATTERN.test(label)) return motion
    }
  }

  return undefined
}
