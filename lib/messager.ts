import { defineExtensionMessaging } from '@webext-core/messaging'
import type { UnsubscribePlan } from './unsubscribe'

export const bgMessager = defineExtensionMessaging<{
  // popup to background
  refreshThreads(): void
  // popup to background
  gmailAction(data: GmailAction): void
  // popup to background: thread url -> how it was done, null if no option
  unsubscribe(url: string): UnsubscribePlan['kind'] | null
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
