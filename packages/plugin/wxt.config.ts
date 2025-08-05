import { defineConfig, UserManifest } from 'wxt'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()] as any,
  }),
  manifestVersion: 3,
  zip: {
    name: 'gmail-notifier',
  },
  manifest: (env) => {
    const manifest: UserManifest = {
      name: 'Gmail Notifier',
      description: 'Gmail Notifier on Browser',
      permissions: ['storage', 'cookies', 'alarms', 'notifications', 'webRequest', 'idle', 'contextMenus'],
      host_permissions: [
        'https://mail.google.com/**',
        'https://gmail.googleapis.com/gmail/v1/**',
        'https://gmail-notifier.rxliuli.com/**',
      ],
      author: {
        email: 'rxliuli@gmail.com',
      },
      action: {
        default_icon: {
          '16': 'icon/16.png',
          '32': 'icon/32.png',
          '48': 'icon/48.png',
          '96': 'icon/96.png',
          '128': 'icon/128.png',
        },
      },
      homepage_url: 'https://rxliuli.com/projects/gmail-notifier',
    }
    if (env.browser === 'chrome' || env.browser === 'edge') {
      manifest.permissions!.push('offscreen')
    }
    if (env.browser === 'firefox') {
      manifest.browser_specific_settings = {
        gecko: {
          id: manifest.name!.toLowerCase().replaceAll(' ', '-') + '@rxliuli.com',
        },
      }
      // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/author
      // @ts-expect-error
      manifest.author = 'rxliuli'
    }
    return manifest
  },
  webExt: {
    disabled: true,
  },
})
