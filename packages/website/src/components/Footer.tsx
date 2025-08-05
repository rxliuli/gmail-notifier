import { ThemeToggle } from '@/integrations/theme'

export function Footer() {
  return (
    <footer className="border-t">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground md:mr-auto">
            © {new Date().getFullYear()} Gmail Notifier. All rights reserved.
          </p>
          <div className="flex items-center space-x-4">
            <a href="https://discord.gg/5jkx5G6dUJ" className="text-sm text-muted-foreground hover:text-foreground">
              Discord
            </a>
            <a
              href="https://github.com/rxliuli/gmail-notifier"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              GitHub
            </a>
          </div>
          <div className="flex items-center gap-2">
            <a href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
              Privacy Policy
            </a>
            <a href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
              Terms of Service
            </a>
            <a href="/refund" className="text-sm text-muted-foreground hover:text-foreground">
              Refund Policy
            </a>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  )
}
