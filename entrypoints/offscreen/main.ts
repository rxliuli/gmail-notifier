import { offscreenMessager } from '@/lib/messager'

offscreenMessager.onMessage('playAudio', async (ev) => {
  const audio = new Audio(ev.data)
  await audio.play()
})
