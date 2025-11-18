import { defineExtensionMessaging } from '@webext-core/messaging'
import { PublicPath } from 'wxt/browser'

export const bgMessager = defineExtensionMessaging<{
  // popup to background
  refreshThreads(): void
  // popup to background
  gmailAction(data: GmailAction): void
}>()

export type GmailAction =
  | {
      cmd: 'archive' | 'markAsRead' | 'markAsUnread' | 'markAsSpam' | 'deleteMail' | 'viewed'
      url: string
    }
  | {
      cmd: 'markAllAsRead'
      urls: string[]
    }

interface OffscreenApi {
  playAudio(path: PublicPath): void
}

export const offscreenMessager = defineExtensionMessaging<OffscreenApi>()

export const popupMessager = defineExtensionMessaging<{
  refreshPopup(): void
}>()
