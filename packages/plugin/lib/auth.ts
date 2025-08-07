import { AccessTokenResponse, MeResponse } from '@gmail-notifier/server'
import { openLoginWindow } from './utils/openLoginWindow'

export function login(prompt?: 'consent') {
  const baseUrl = import.meta.env.DEV ? 'http://localhost:5173' : 'https://gmail-notifier.rxliuli.com'
  const url = new URL(baseUrl)
  url.pathname = '/login'
  url.searchParams.set('from', 'plugin')
  if (prompt === 'consent') {
    url.searchParams.set('prompt', prompt)
  }
  openLoginWindow(url.toString())
}

export async function setUser(user: MeResponse) {
  await browser.storage.local.set({ user })
}

export async function cleanAuth() {
  await browser.storage.local.remove('user')
  await browser.storage.local.remove('accessToken')
}

export async function logout() {
  await cleanAuth()
  window.location.reload()
}

export async function getAccessToken() {
  const r = await browser.storage.local.get<{
    accessToken?: AccessTokenResponse
  }>('accessToken')
  return r.accessToken
}

export async function setAccessToken(accessToken: AccessTokenResponse) {
  await browser.storage.local.set({ accessToken })
}

export async function getUser() {
  const r = await browser.storage.local.get<{
    user?: MeResponse
  }>('user')
  return r.user
}
