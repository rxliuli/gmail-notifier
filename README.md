# Gmail Notifier

A **100% open-source** Gmail notifier extension for your browser - including the server and website code.

## 📋 Features

- ✅ **Completely Open Source** - Extension, server, and website code all publicly available
- ✅ **Real-time Notifications** - Get instant desktop notifications for new emails
- ✅ **Quick Actions** - Mark as read, archive, delete emails without opening Gmail
- ✅ **Quick Reply** - Reply to emails directly from the extension
- ✅ **Bulk Operations** - Mark all emails as read with one click
- ✅ **Modern UI** - Clean, intuitive interface that works seamlessly
- ✅ **Privacy Focused** - All code is auditable, no hidden tracking
- ✅ **Self-Hostable** - Run your own instance if preferred

### 🚀 Coming Soon

- 🌙 Dark mode support
- 👥 Multiple account support
- 🎨 Customizable themes
- 🔍 Email filtering rules

## 📥 Installation

### Browser Extension

#### Chrome/Edge/Brave

1. Visit the [Chrome Web Store](https://chromewebstore.google.com/detail/gmail-notifier/liabcmaifgemdglcbialogmljhekgnle?authuser=0&hl=en)
2. Click "Add to Chrome"
3. Follow the setup instructions

#### Firefox

1. Visit the [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/gmail-notifier233/) (coming soon)
2. Click "Add to Firefox"
3. Follow the setup instructions

### Beta Testing

We're currently in beta! To join:

1. Join our [Discord server](https://discord.gg/5jkx5G6dUJ)
2. Go to `#gmail-notifier` channel
3. Send me a DM with your Gmail address to be added to the beta testers list

## 🛠️ Development

### Prerequisites

- Node.js 24+
- pnpm
- A Google Cloud Platform account (for Gmail API)

### Setup

1. Clone the repository:

   ```sh
   git clone https://github.com/rxliuli/gmail-notifier.git
   cd gmail-notifier
   pnpm i
   ```

2. Run the extension in development mode:

   ```sh
   cd packages/plugin
   pnpm dev
   ```

3. Run the server in development mode:

   ```sh
   cd packages/server
   pnpm dev
   ```
