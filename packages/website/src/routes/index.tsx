import { Bell, Mail, Shield, Globe } from 'lucide-react'
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <div className="max-w-4xl mx-auto space-y-24">
      {/* Hero Section */}
      <section className="text-center space-y-8">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Never Miss an Important Email Again</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Get instant notifications for your Gmail messages, with a beautiful and secure interface. Works across all
          major browsers.
        </p>
        <div className="flex items-center justify-center gap-4">
          <a
            href="https://chromewebstore.google.com/detail/liabcmaifgemdglcbialogmljhekgnle"
            target="_blank"
            className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90"
          >
            Get Extension
          </a>
          <Link to="/pricing" className="border border-input px-6 py-3 rounded-lg font-medium hover:bg-accent">
            View Pricing
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="space-y-4">
          <Bell className="h-8 w-8 text-primary" />
          <h3 className="text-xl font-semibold">Instant Notifications</h3>
          <p className="text-muted-foreground">Get notified immediately when new emails arrive in your inbox.</p>
        </div>
        <div className="space-y-4">
          <Mail className="h-8 w-8 text-primary" />
          <h3 className="text-xl font-semibold">Quick Actions</h3>
          <p className="text-muted-foreground">View, archive, delete, or mark all as read with quick actions.</p>
        </div>
        <div className="space-y-4">
          <Shield className="h-8 w-8 text-primary" />
          <h3 className="text-xl font-semibold">100% Open Source</h3>
          <p className="text-muted-foreground">Full transparency with complete source code available.</p>
        </div>
        <div className="space-y-4">
          <Globe className="h-8 w-8 text-primary" />
          <h3 className="text-xl font-semibold">Cross-Browser</h3>
          <p className="text-muted-foreground">Works on Chrome, Edge, and Firefox.</p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center space-y-8 bg-accent/50 rounded-2xl p-12">
        <h2 className="text-3xl font-bold">Ready to Get Started?</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Try Gmail Notifier free for 14 days. No credit card required.
        </p>
        <Link
          to="/login"
          className="inline-block bg-primary text-primary-foreground px-8 py-4 rounded-lg font-medium hover:bg-primary/90"
        >
          Start Free Trial
        </Link>
      </section>
    </div>
  )
}
