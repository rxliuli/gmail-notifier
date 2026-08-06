import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'

// Pin the timezone so date-parsing tests (formatDate, extractThreadMail) are
// deterministic regardless of the host machine's/CI runner's local timezone.
process.env.TZ = 'Asia/Singapore'

export default defineConfig({
  plugins: [react()],
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      // https://vitest.dev/guide/browser/playwright
      instances: [{ browser: 'chromium', headless: true }],
    },
  },
  resolve: {
    alias: {
      '@': import.meta.dirname,
    },
  },
  optimizeDeps: {
    include: ['@webext-core/fake-browser'],
  },
})
