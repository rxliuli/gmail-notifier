const STORAGE_KEY = 'debugLogs'
const MAX_ENTRIES = 300

function formatArg(arg: unknown): string {
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}`
  }
  if (typeof arg === 'string') {
    return arg
  }
  try {
    return JSON.stringify(arg)
  } catch {
    return String(arg)
  }
}

function hasBrowser() {
  return 'browser' in globalThis || 'chrome' in globalThis
}

// Safari's Web Inspector doesn't reliably surface console output from
// extension background/popup contexts, and drops anything logged before the
// inspector was opened. Persist a rolling log buffer to storage.local (shared
// across every context, survives service worker restarts) so it can still be
// read after the fact.
export async function debugLog(...args: unknown[]) {
  console.log(...args)
  if (!hasBrowser()) {
    return
  }
  const line = `[${new Date().toISOString()}] ${args.map(formatArg).join(' ')}`
  try {
    const { [STORAGE_KEY]: existing = [] } = await browser.storage.local.get<Record<string, string[]>>(STORAGE_KEY)
    await browser.storage.local.set({ [STORAGE_KEY]: [...existing, line].slice(-MAX_ENTRIES) })
  } catch (err) {
    console.error('debugLog: failed to persist log entry', err)
  }
}

export async function getDebugLogs(): Promise<string[]> {
  const { [STORAGE_KEY]: logs = [] } = await browser.storage.local.get<Record<string, string[]>>(STORAGE_KEY)
  return logs
}

export async function clearDebugLogs() {
  await browser.storage.local.remove(STORAGE_KEY)
}
