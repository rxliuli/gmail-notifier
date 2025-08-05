import { sortBy, uniqBy } from 'es-toolkit'
import { Feed, RSSInfo, ThreadMail } from './api/gmail'

export interface EmailThread extends Feed, ThreadMail {}

export interface GmailApi {
  checkLoginStatus: () => Promise<boolean>
  getRSS: () => Promise<RSSInfo>
  getThreadMail: (url: string) => Promise<ThreadMail>
  markAsRead: (url: string) => Promise<void>
  markAsUnread: (url: string) => Promise<void>
  archive: (url: string) => Promise<void>
  delete: (url: string) => Promise<void>
  markAsSpam: (url: string) => Promise<void>
  // star: (url: string) => Promise<void>
  // unstar: (url: string) => Promise<void>
}

// persistent service worker
// https://stackoverflow.com/questions/66618136/persistent-service-worker-in-chrome-extension#:~:text=%E2%AD%95%20Bug%20exploit%20in%20Chrome%20110%2B
export class StateManager {
  isLoggedIn: boolean = false
  email: string | null = null
  threads: EmailThread[] = []
  notifiedEmails: Set<string> = new Set()
  viewedEmails: Set<string> = new Set()

  constructor(private readonly api: GmailApi) {}

  private listeners: ((threads: EmailThread[]) => Promise<void>)[] = []
  on(cb: (threads: EmailThread[]) => Promise<void>) {
    this.listeners.push(cb)
  }
  off(cb: (threads: EmailThread[]) => Promise<void>) {
    this.listeners = this.listeners.filter((it) => it !== cb)
  }

  private async notify() {
    if ('browser' in globalThis || 'chrome' in globalThis) {
      await browser.storage.session.set({
        isLoggedIn: this.isLoggedIn,
        email: this.email,
        threads: this.threads,
        notifiedEmails: Array.from(this.notifiedEmails),
      })
    }
    for (const cb of this.listeners) {
      await cb(this.threads)
    }
    this.threads.forEach((it) => {
      this.notifiedEmails.add(it.url)
    })
  }

  getNewThreads() {
    return this.threads.filter((it) => !this.notifiedEmails.has(it.url))
  }
  getUnreadThreads() {
    return this.threads.filter((it) => !this.viewedEmails.has(it.url))
  }

  async fetchThreads(force = false) {
    if (!navigator.onLine) {
      return
    }
    this.isLoggedIn = await this.api.checkLoginStatus()
    if (!this.isLoggedIn) {
      this.notify()
      return
    }
    const rss = await this.api.getRSS()
    this.email = rss.email
    this.threads = force
      ? []
      : this.threads.filter(
          (t) =>
            // Keep read emails
            this.viewedEmails.has(t.url) ||
            // Keep unchanged emails
            rss.feeds.find((it) => it.url === t.url)?.modified === t.modified,
        )
    const newFeeds = rss.feeds.filter((it) => !this.threads.find((t) => t.url === it.url))
    const newThreads = await Promise.all(
      newFeeds.map(async (it) => {
        const details = await this.api.getThreadMail(it.url)
        return {
          ...it,
          ...details,
        } satisfies EmailThread
      }),
    )
    this.threads = uniqBy([...this.threads, ...newThreads], (it) => it.url).sort((a, b) =>
      b.modified.localeCompare(a.modified),
    )
    console.debug('fetchThreads', rss, this.threads)
    this.notify()
  }
  async clearViewed() {
    this.threads = this.threads.filter((t) => !this.viewedEmails.has(t.url))
    this.viewedEmails.clear()
    await this.notify()
  }

  async markAsRead(url: string) {
    this.threads = this.threads.filter((t) => t.url !== url)
    this.api.markAsRead(url).catch((err) => {
      console.error('markAsRead', err)
      this.fetchThreads()
    })
    await this.notify()
  }
  async markAsUnread(url: string) {
    this.viewedEmails.delete(url)
    this.api.markAsUnread(url).catch((err) => {
      console.error('markAsUnread', err)
      this.fetchThreads()
    })
    await this.notify()
  }
  async viewed(url: string) {
    this.viewedEmails.add(url)
    this.api.markAsRead(url).catch((err) => {
      console.error('viewed', err)
      this.fetchThreads()
    })
    await this.notify()
  }
  async markAllAsRead(urls: string[]) {
    this.threads = this.threads.filter((t) => !urls.includes(t.url))
    Promise.allSettled(urls.map((url) => this.api.markAsRead(url))).catch((err) => {
      console.error('markAllAsRead', err)
      this.fetchThreads()
    })
    await this.notify()
  }
  async refresh() {
    this.viewedEmails.clear()
    await this.fetchThreads(true)
  }
  async archive(url: string) {
    this.threads = this.threads.filter((t) => t.url !== url)
    this.api.archive(url).catch((err) => {
      console.error('archive', err)
      this.fetchThreads()
    })
    await this.notify()
  }
  async delete(url: string) {
    this.threads = this.threads.filter((t) => t.url !== url)
    this.api.delete(url).catch((err) => {
      console.error('delete', err)
      this.fetchThreads()
    })
    await this.notify()
  }
  async markAsSpam(url: string) {
    this.threads = this.threads.filter((t) => t.url !== url)
    this.api.markAsSpam(url).catch((err) => {
      console.error('markAsSpam', err)
      this.fetchThreads()
    })
    await this.notify()
  }
}
