import { bgMessager, offscreenMessager, popupMessager } from '@/lib/messager'
import {
  archiveMail,
  checkLoginStatus,
  deleteMail,
  getRSS,
  getThreadMail,
  markAsRead,
  markAsSpam,
  markAsUnread,
  openMailInWeb,
  type Feed,
} from '@/lib/api/gmail'
import { PublicPath } from 'wxt/browser'
import { StateManager } from '@/lib/StateManager'
import { registerActionMenus } from '@/lib/menu'
import { menus } from '@/lib/constants'

// Update badge
async function updateBadge(unreadCount: number) {
  if (unreadCount === 0) {
    browser.action.setBadgeText({ text: '' })
    return
  }
  await browser.action.setBadgeText({ text: unreadCount.toString() })
  await browser.action.setBadgeBackgroundColor({ color: '#FF0000' })
  await browser.action.setBadgeTextColor({ color: '#FFFFFF' })
}

async function sendNotification(stateManager: StateManager, feed: Feed) {
  const notificationId = `gmail-notifier-${import.meta.env.MODE}-${feed.url}`

  if (stateManager.notifiedEmails.has(feed.url)) {
    return
  }

  await browser.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: '/icon/48.png' as PublicPath,
    title: import.meta.env.DEV ? 'DEV: ' + feed.title : feed.title,
    message: `From: ${feed.author.name} <${feed.author.email}>\n${feed.summary}`,
  })
  browser.notifications.onClicked.addListener(async (id) => {
    await browser.notifications.clear(id)
    if (id === notificationId) {
      await browser.action.openPopup()
      browser.notifications.clear(notificationId)
    }
  })
  setTimeout(async () => {
    console.log('auto clear notification', notificationId)
    await browser.notifications.clear(notificationId)
  }, 10 * 1000)

  if (import.meta.env.CHROME || import.meta.env.EDGE) {
    const hasDocument = await browser.offscreen.hasDocument()
    if (!hasDocument) {
      await browser.offscreen.createDocument({
        url: '/offscreen.html',
        reasons: ['DOM_SCRAPING', 'AUDIO_PLAYBACK'],
        justification: 'Gmail Notifier',
      })
    }
    await offscreenMessager.sendMessage('playAudio', '/audio/notification1.mp3')
  }
}

export default defineBackground(async () => {
  const stateManager = new StateManager({
    checkLoginStatus,
    getRSS,
    getThreadMail,
    markAsRead,
    archive: async (url) => {
      await archiveMail(url)
    },
    delete: async (url) => {
      await deleteMail(url)
    },
    markAsSpam: async (url) => {
      await markAsSpam(url)
    },
    markAsUnread: async (url) => {
      await markAsUnread(url)
    },
  })
  // badge listener
  stateManager.on(async () => {
    await updateBadge(stateManager.getUnreadThreads().length)
  })
  // popup listener
  browser.runtime.onConnect.addListener((port) => {
    if (port.name === 'popup') {
      async function f(): Promise<void> {
        await popupMessager.sendMessage('refreshPopup', undefined)
      }
      stateManager.on(f)
      port.onDisconnect.addListener(function () {
        stateManager.off(f)
        stateManager.clearViewed()
      })
    }
  })
  // notification listener
  stateManager.on(async () => {
    const newFeeds = stateManager.getNewThreads()
    if (newFeeds.length === 0) {
      return
    }
    await sendNotification(stateManager, newFeeds[0])
  })

  // listen to polling event
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'fetchThreads') {
      await stateManager.fetchThreads()
    }
  })
  browser.idle.onStateChanged.addListener(async (state) => {
    if (state === 'active') {
      const alarms = await browser.alarms.get('fetchThreads')
      if (!alarms) {
        await browser.alarms.create('fetchThreads', { periodInMinutes: 0.5 })
      }
    } else {
      await browser.alarms.clear('fetchThreads')
    }
  })
  globalThis.addEventListener('online', async () => {
    const alarms = await browser.alarms.get('fetchThreads')
    if (!alarms) {
      await browser.alarms.create('fetchThreads', { periodInMinutes: 0.5 })
    }
  })
  globalThis.addEventListener('offline', () => {
    browser.alarms.clear('fetchThreads')
  })

  // listen to webRequest
  browser.webRequest.onBeforeRequest.addListener(
    () => {
      setTimeout(() => stateManager.fetchThreads(), 1000)
      return {}
    },
    {
      urls: ['https://mail.google.com/sync/*'],
    },
  )

  // listen to message
  bgMessager.onMessage('refreshThreads', () => stateManager.refresh())
  bgMessager.onMessage('gmailAction', async (ev) => {
    const data = ev.data
    if (data.cmd === 'markAsRead') {
      await stateManager.markAsRead(data.url)
      return
    }
    if (data.cmd === 'viewed') {
      await stateManager.viewed(data.url)
      return
    }
    if (data.cmd === 'markAllAsRead') {
      await stateManager.markAllAsRead(data.urls)
      return
    }
    if (data.cmd === 'archive') {
      await stateManager.archive(data.url)
      return
    }
    if (data.cmd === 'deleteMail') {
      await stateManager.delete(data.url)
      return
    }
    if (data.cmd === 'markAsSpam') {
      await stateManager.markAsSpam(data.url)
      return
    }
    if (data.cmd === 'markAsUnread') {
      await stateManager.markAsUnread(data.url)
      return
    }
    throw new Error('Unknown command')
  })

  browser.runtime.onInstalled.addListener(async () => {
    registerActionMenus(menus)
  })
  browser.contextMenus.onClicked.addListener(async (info) => {
    if (info.menuItemId === 'open-gmail') {
      await openMailInWeb('https://mail.google.com/mail/u/0/#inbox')
      return
    }
    if (info.menuItemId === 'refresh') {
      await stateManager.refresh()
      return
    }
    throw new Error('Unknown menu item id: ' + info.menuItemId)
  })

  await browser.alarms.create('fetchThreads', { periodInMinutes: 0.5 })
  await stateManager.fetchThreads() // fetch threads on startup
})
