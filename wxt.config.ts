import { defineConfig, type UserManifest } from 'wxt'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  modules: ['@wxt-dev/module-react', '@extport/wxt'],
  extport: {
    extension: 'ext_lvL1FBBhpL2nsJE2QBhx',
    safari: {
      appCategory: 'public.app-category.productivity',
      bundleIdentifier: 'com.rxliuli.gmail-notifier',
      developmentTeam: 'N2X78TUUFG',
      issuerId: '48f39427-c063-4e33-98d2-31de80aad0be',
      keyId: '8N27UWG9RG',
      projectType: 'macos',
      openProject: true,
    },
    analytics: true,
  },
  vite: () => ({
    plugins: [tailwindcss()] as any,
    build: {
      minify: false,
      sourcemap: true,
    },
  }),
  manifestVersion: 3,
  zip: {
    name: 'gmail-notifier',
  },
  manifest: (env) => {
    const manifest: UserManifest = {
      name: 'Gmail Notifier',
      description:
        'Get notified of new emails in your browser and quickly manage your messages.',
      permissions: [
        'storage',
        'cookies',
        'alarms',
        'webRequest',
        'contextMenus',
      ],
      host_permissions: ['https://mail.google.com/**'],
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
      homepage_url: 'https://github.com/rxliuli/gmail-notifier',
    }
    if (env.browser === 'chrome' || env.browser === 'edge') {
      manifest.permissions!.push('notifications', 'idle')
    }
    if (env.browser === 'firefox') {
      manifest.permissions!.push('notifications', 'idle')
      manifest.browser_specific_settings = {
        gecko: {
          id:
            manifest.name!.toLowerCase().replaceAll(' ', '-') + '@rxliuli.com',
        },
      }
      // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/author
      // @ts-expect-error
      manifest.author = 'rxliuli'
    }
    if (env.browser === 'safari') {
      manifest.name = 'Inbox Notifier for Gmail'
    }
    return manifest
  },
  hooks: {
    // Safari's MV3 service_worker background is badly limited (multiple
    // WebKit/Safari-18 bugs: fetch(credentials:'include') and
    // cookies.getAll() silently missing cookies from a service worker,
    // confirmed via Apple's own developer forums). Rewriting it to the MV2
    // `scripts` form routes through a more mature code path that doesn't
    // have this problem. persistent: false keeps it non-persistent still.
    'build:manifestGenerated': (wxt, manifest) => {
      if (
        wxt.config.browser === 'safari' &&
        manifest.background &&
        'service_worker' in manifest.background
      ) {
        const sw = manifest.background.service_worker
        manifest.background = {
          scripts: [sw],
          persistent: false,
        }
      }
    },
  },
  webExt: {
    disabled: true,
  },
})
