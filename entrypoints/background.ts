import { bgMessager, popupMessager } from '@/lib/messager'
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
import type { PublicPath } from 'wxt/browser'
import { StateManager } from '@/lib/StateManager'
import { registerActionMenus } from '@/lib/menu'
import { menus } from '@/lib/constants'
import { debugLog } from '@/lib/debugLog'

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

  // Safari doesn't support the notifications API (same "unsupported manifest
  // key" warning as idle) - skip instead of throwing.
  if (!browser.notifications) {
    await debugLog(
      'sendNotification: browser.notifications unsupported, skipping',
    )
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
}

export default defineBackground(async () => {
  await debugLog('background: starting up')
  try {
    await start()
    await debugLog('background: startup complete')
  } catch (err) {
    // A throw anywhere in start() aborts every registration after it -
    // this is the only thing standing between that and total silence (the
    // idle API being unsupported on Safari did exactly this: everything
    // after browser.idle.onStateChanged.addListener() - the alarm, the
    // startup fetch - just never ran, with no error visible anywhere).
    await debugLog('background: startup failed ->', err)
  }
})

async function start() {
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
  browser.runtime.onConnect.addListener(async (port) => {
    if (port.name === 'popup') {
      await debugLog('background: popup port connected')
      async function f(): Promise<void> {
        await popupMessager.sendMessage('refreshPopup', undefined)
      }
      stateManager.on(f)
      port.onDisconnect.addListener(async function () {
        await debugLog('background: popup port disconnected')
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
    await sendNotification(stateManager, newFeeds[0]!)
  })

  // listen to polling event
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'fetchThreads') {
      await stateManager.fetchThreads()
    }
  })
  // Safari doesn't support the idle API at all (confirmed by the "idle" key
  // warning wxt/extport prints when converting the Safari build) - accessing
  // browser.idle there throws synchronously and, since this whole callback
  // is one async function, silently aborted every registration after it:
  // no alarm, no startup fetch, nothing - with zero indication why.
  if (browser.idle) {
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
  } else {
    await debugLog(
      'background: browser.idle unsupported, skipping idle-based alarm management',
    )
  }
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
  // Gmail's own tab, when open, hits /sync/* via long-polling multiple
  // times a second - unthrottled, that fired fetchThreads() at the same
  // rate. Each completion notifies listeners (badge, popup push), so with
  // the popup open this was re-rendering it in a tight loop, felt as
  // sluggish scrolling (worse on Safari's WKWebView popup than Chrome's).
  // The 30s alarm above already guarantees a baseline poll; this listener
  // only needs to react faster than that, not react to every single ping.
  const WEBREQUEST_FETCH_COOLDOWN_MS = 10_000
  let lastWebRequestFetchAt = 0
  browser.webRequest.onBeforeRequest.addListener(
    () => {
      const now = Date.now()
      if (now - lastWebRequestFetchAt < WEBREQUEST_FETCH_COOLDOWN_MS) {
        return {}
      }
      lastWebRequestFetchAt = now
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

  // Fire-and-forget: don't let alarms.create() block the actual mail fetch
  // below. Can't assume it returns a real Promise either - on Safari it
  // returned undefined, and chaining .then() on that threw and took down
  // the rest of startup with it.
  await debugLog('background: creating fetchThreads alarm')
  try {
    const created = browser.alarms.create('fetchThreads', {
      periodInMinutes: 0.5,
    })
    if (
      created &&
      typeof (created as unknown as Promise<void>).then === 'function'
    ) {
      ;(created as unknown as Promise<void>).then(
        () => debugLog('background: fetchThreads alarm created'),
        (err) =>
          debugLog('background: fetchThreads alarm creation failed ->', err),
      )
    } else {
      await debugLog(
        'background: fetchThreads alarm create() returned a non-promise, assuming it succeeded',
      )
    }
  } catch (err) {
    await debugLog('background: fetchThreads alarm creation threw ->', err)
  }
  await debugLog('background: running startup fetchThreads')
  await fetchThreadsWithRetry(stateManager)
}

// Confirmed on Safari: a manual fetch(..., {credentials:'include'}) run from
// the console a moment later succeeds fine with the exact same code that
// just 401'd here - looks like the cookie/ITP state isn't fully settled in
// the first instant the service worker starts. Retry a few times instead of
// giving up after one attempt right at cold start.
async function fetchThreadsWithRetry(
  stateManager: StateManager,
  attempts = 3,
  delayMs = 1500,
) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await stateManager.fetchThreads()
      await debugLog(
        `background: startup fetchThreads succeeded on attempt ${attempt}`,
      )
      return
    } catch (err) {
      await debugLog(
        `background: startup fetchThreads attempt ${attempt}/${attempts} failed ->`,
        err,
      )
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }
  await debugLog(
    `background: startup fetchThreads gave up after ${attempts} attempts`,
  )
}
