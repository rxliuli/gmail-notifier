import { get, set, del } from 'idb-keyval'
import { ulid } from 'ulid'
import Bowser from 'bowser'

interface Plan {
  tier: 'free' | 'basic' | 'pro'
  limit: {
    downloadMedia: boolean
    records: number
    concurrency: number
  }
}

export interface PlanConfig {
  code: string
  tier: 'basic' | 'pro'
  expiresAt: string
  fingerprint: string
}

let plan: Plan | undefined = undefined

export function getCurrentPlan(): Plan {
  return plan ?? getPlanByConfig()
}

export async function getPlan(): Promise<Plan> {
  const config = await get<PlanConfig>('plan')
  plan = getPlanByConfig(config)
  return plan
}

function getPlanByConfig(config?: PlanConfig): Plan {
  const freePlan: Plan = {
    tier: 'free',
    limit: {
      downloadMedia: false,
      records: 1000,
      concurrency: 1,
    },
  }
  if (!config) {
    return freePlan
  }
  if (config.expiresAt && new Date(config.expiresAt) < new Date()) {
    return freePlan
  }
  if (config.tier === 'basic') {
    return {
      tier: 'basic',
      limit: {
        downloadMedia: false,
        records: 100000,
        concurrency: 3,
      },
    }
  }
  if (config.tier === 'pro') {
    return {
      tier: 'pro',
      limit: {
        downloadMedia: true,
        records: Number.MAX_SAFE_INTEGER,
        concurrency: Number.MAX_SAFE_INTEGER,
      },
    }
  }
  return freePlan
}

interface ActivateRequest {
  code: string
  productName: string
  fingerprint: string
  deviceInfo: any
}

interface ActivateResponse {
  success: boolean
  message: string
  data?: {
    expiresAt: string
    tier: string
  }
}

export async function activate(code: string): Promise<ActivateResponse> {
  const baseUrl = import.meta.env.DEV ? 'http://localhost:8787' : 'https://store.rxliuli.com'
  console.log('Activating with code:', code, baseUrl)
  const config = await get<PlanConfig>('plan')
  const fingerprint = config?.fingerprint ?? ulid()
  const resp = await fetch(`${baseUrl}/api/activation/activate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      productName: 'Gmail Notifier',
      fingerprint,
      deviceInfo: Bowser.getParser(navigator.userAgent).getResult(),
    } satisfies ActivateRequest),
  })
  if (!resp.ok) {
    throw resp
  }
  const r = (await resp.json()) as ActivateResponse
  if (!r.success || !r.data) {
    return r
  }
  await set('plan', {
    tier: r.data.tier as any,
    expiresAt: r.data.expiresAt,
    code,
    fingerprint,
  } satisfies PlanConfig)
  await getPlan()
  return r
}

interface CheckDeviceRequest {
  code: string
  productName: string
  fingerprint: string
}

interface CheckDeviceResponse {
  success: boolean
  message: string
  data?: {
    isActive: string
    expiresAt: string
  }
}

export async function checkActivation() {
  const config = await get<PlanConfig>('plan')
  if (!config) {
    return
  }
  const baseUrl = import.meta.env.DEV ? 'http://localhost:8787' : 'https://store.rxliuli.com'
  const resp = await fetch(`${baseUrl}/api/activation/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: config.code,
      productName: 'Gmail Notifier',
      fingerprint: config.fingerprint,
    } satisfies CheckDeviceRequest),
  })
  if (!resp.ok) {
    throw resp
  }
  const r = (await resp.json()) as CheckDeviceResponse
  if (!r.success) {
    throw new Error(`Check device failed: ${r.message}`)
  }
  if (!r.data) {
    throw new Error('Check device failed: no data')
  }
  if (!r.data.isActive || (r.data.expiresAt && new Date(r.data.expiresAt).getTime() < new Date().getTime())) {
    await del('plan')
    plan = undefined
    await getPlan()
    return false
  }
}
