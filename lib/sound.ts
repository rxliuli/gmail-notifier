import { debugLog } from '@/lib/debugLog'

// The user's own sound file, kept as a data URL: an extension can't read a
// file:// path later, so the file's bytes have to be stored when it's picked.
export interface NotificationSound {
  name: string
  dataUrl: string
}

const STORAGE_KEY = 'notificationSound'
export const MAX_SOUND_BYTES = 2 * 1024 * 1024

export async function getNotificationSound(): Promise<NotificationSound | null> {
  const { [STORAGE_KEY]: sound = null } = await browser.storage.local.get<Record<string, NotificationSound | null>>(
    STORAGE_KEY,
  )
  return sound
}

export async function setNotificationSound(file: File): Promise<NotificationSound> {
  if (file.size > MAX_SOUND_BYTES) {
    throw new Error(`Sound file is larger than ${MAX_SOUND_BYTES / 1024 / 1024} MB`)
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  const sound = { name: file.name, dataUrl }
  await browser.storage.local.set({ [STORAGE_KEY]: sound })
  return sound
}

export async function clearNotificationSound() {
  await browser.storage.local.remove(STORAGE_KEY)
}

export async function playSound(sound: NotificationSound) {
  await new Audio(sound.dataUrl).play()
}

// Plays the chosen sound, if any. Needs a page with Audio: Firefox's
// background is an event page and has one; Chrome's service worker doesn't.
export async function playNotificationSound() {
  if (typeof Audio === 'undefined') return
  const sound = await getNotificationSound()
  if (!sound) return
  try {
    await playSound(sound)
  } catch (err) {
    await debugLog('playNotificationSound: failed ->', String(err))
  }
}
