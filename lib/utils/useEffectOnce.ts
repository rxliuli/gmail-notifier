import { useEffect, type EffectCallback } from 'react'

export function useEffectOnce(effect: EffectCallback) {
  useEffect(effect, [])
}
