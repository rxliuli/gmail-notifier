import { defineExtensionMessaging } from '@webext-core/messaging'

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

export const popupMessager = defineExtensionMessaging<{
  refreshPopup(): void
}>()
