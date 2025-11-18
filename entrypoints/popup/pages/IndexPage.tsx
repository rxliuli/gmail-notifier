import { Button } from '@/components/ui/button'
import { openMailInWeb, newEmail } from '@/lib/api/gmail'
import { bgMessager, GmailAction, popupMessager } from '@/lib/messager'
import { useMutation } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  BanIcon,
  ArchiveIcon,
  Trash2Icon,
  MailOpenIcon,
  ExternalLinkIcon,
  MoreVerticalIcon,
  SquareArrowOutUpRightIcon,
  MailPlusIcon,
  KeyIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { RefreshIcon } from '@/components/extra/RefreshIcon'
import { useMailStore } from '@/lib/mailStore'
import { DetailPage } from './DetailPage'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FaDiscord, FaGithub } from 'react-icons/fa'
import { EmailThread } from '@/lib/StateManager'
import { getCurrentPlan, activate } from '@/lib/activation'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { get, set } from 'idb-keyval'
import { useMount } from '@/lib/utils/useMount'
import { useEffectOnce } from '@/lib/utils/useEffectOnce'

function MailItem({ thread, onClick }: { thread: EmailThread; onClick: () => void }) {
  const store = useMailStore()
  async function gmailAction(cmd: Exclude<GmailAction['cmd'], 'markAllAsRead'>, msg: string) {
    await bgMessager.sendMessage('gmailAction', {
      cmd,
      url: thread.url,
    })
    await store.refresh()
    toast.success(msg)
  }
  return (
    <div
      key={thread.url}
      className="flex items-stretch gap-3 px-4 py-3 group transition relative border-b last:border-b-0 bg-background"
      onClick={onClick}
    >
      {/* Avatar */}
      <div className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold mt-1">
        {thread.author.name.charAt(0)}
      </div>
      {/* Email content area */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        {/* Title row: sender, subject, time/action buttons */}
        <div className="flex items-center justify-between h-6 w-full space-x-2">
          <span className="font-semibold truncate">
            {thread.author.name} &lt;{thread.author.email}&gt;
          </span>
          {/* Time and action buttons are mutually exclusive and both in this row */}
          <span className="text-xs text-gray-400 whitespace-nowrap group-hover:hidden block">
            {dayjs(thread.modified).format('YYYY-MM-DD HH:mm')}
          </span>
          <div className="flex gap-1 group-hover:flex hidden" onClick={(ev) => ev.stopPropagation()}>
            <Button size="icon" variant="ghost" title={'Archive'} onClick={() => gmailAction('archive', 'Archive')}>
              <ArchiveIcon />
            </Button>
            <Button size="icon" variant="ghost" title={'Trash'} onClick={() => gmailAction('deleteMail', 'Delete')}>
              <Trash2Icon />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title={'Mark as read'}
              onClick={() => gmailAction('markAsRead', 'Mark as read')}
            >
              <MailOpenIcon />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title={'Spam'}
              onClick={() => gmailAction('markAsSpam', 'Mark as spam')}
            >
              <BanIcon />
            </Button>
            <Button size="icon" variant="ghost" title={'Open in Gmail'} onClick={() => openMailInWeb(thread.url)}>
              <ExternalLinkIcon />
            </Button>
          </div>
        </div>
        {/* Subject */}
        <div className="font-bold text-sm truncate">{thread.title}</div>
        {/* Summary */}
        <div className="text-xs text-gray-400 truncate">{thread.summary}</div>
      </div>
    </div>
  )
}

function Toolbar({ onShowLicense }: { onShowLicense: () => void }) {
  const store = useMailStore()
  const refreshMutation = useMutation({
    mutationFn: () => bgMessager.sendMessage('refreshThreads', undefined),
  })

  async function markAllAsRead(msg: string) {
    try {
      await bgMessager.sendMessage('gmailAction', {
        cmd: 'markAllAsRead',
        urls: store.threads.map((t) => t.url),
      })
      toast.success(msg)
    } catch (err) {
      console.error(err)
      toast.error(msg + ' failed')
    }
  }

  const plan = getCurrentPlan()

  return (
    <div className="flex items-center px-4 py-2 bg-card shadow-sm border-b border-border gap-2 sticky top-0 z-10">
      {/* Gmail icon */}
      <div className="flex items-center">
        <img src="/icon/48.png" alt="Gmail Notifier" className="w-6 h-6" />
      </div>
      <span className="font-medium text-foreground flex-1">
        {store.email} ({store.threads.length})
      </span>
      {store.threads.length > 0 && (
        <Button
          size="icon"
          variant="ghost"
          title={'Mark all as read'}
          onClick={() => markAllAsRead('Mark all as read')}
        >
          <MailOpenIcon />
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        title={'Refresh'}
        className={cn('h-8 w-8', refreshMutation.isPending && 'animate-spin pointer-events-none opacity-50')}
        onClick={() => refreshMutation.mutate()}
        disabled={refreshMutation.isPending}
      >
        <RefreshIcon loading={refreshMutation.isPending} />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        title={'Open in Gmail'}
        onClick={() => openMailInWeb('https://mail.google.com/mail/u/0/#inbox')}
      >
        <ExternalLinkIcon />
      </Button>
      <Button size="icon" variant="ghost" title={'New email'} onClick={newEmail}>
        <MailPlusIcon />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" title={'More'}>
            <MoreVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={'end'}>
          <DropdownMenuItem onClick={onShowLicense}>
            <KeyIcon />
            {plan.tier === 'free' ? 'Enter License' : `License: ${plan.tier}`}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`chrome-extension://${browser.runtime.id}/popup.html`} target="_blank">
              <SquareArrowOutUpRightIcon />
              Popout
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href="https://discord.gg/5jkx5G6dUJ" target="_blank">
              <FaDiscord />
              Join our community
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="https://github.com/rxliuli/gmail-notifier" target="_blank">
              <FaGithub />
              GitHub
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function MailList({ threads, onSelectFeed }: { threads: EmailThread[]; onSelectFeed: (thread: EmailThread) => void }) {
  return (
    <div className="w-full">
      {threads.map((thread) => (
        <MailItem key={thread.url} thread={thread} onClick={() => onSelectFeed(thread)} />
      ))}
    </div>
  )
}

function LicenseDialog({ onClose, onActivated }: { onClose: () => void; onActivated: () => void }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleActivate() {
    if (!code.trim()) {
      toast.error('Please enter a license code')
      return
    }
    setLoading(true)
    try {
      const result = await activate(code.trim())
      if (result.success) {
        toast.success('License activated successfully!')
        onActivated()
        onClose()
      } else {
        toast.error(result.message || 'Activation failed')
      }
    } catch (error) {
      console.error('Activation error:', error)
      toast.error('Activation failed. Please check your license code.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Enter License Code</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Gmail Notifier is free to evaluate. If you find it useful, please consider purchasing a license to support
          development.
        </p>
        <Input
          placeholder="Enter your license code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
          className="mb-4"
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleActivate} disabled={loading}>
            {loading ? 'Activating...' : 'Activate'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Don't have a license?{' '}
          <a href="https://gmail-notifier.rxliuli.com/pricing" target="_blank" className="underline">
            Purchase one here
          </a>
        </p>
      </div>
    </div>
  )
}

function HomePage() {
  const store = useMailStore()
  const [showLicense, setShowLicense] = useState(false)
  const [, forceUpdate] = useState({})

  async function onSelectFeed(thread: EmailThread) {
    store.go(thread)
    await bgMessager.sendMessage('gmailAction', {
      cmd: 'viewed',
      url: thread.url,
    })
  }

  // Check if we should show monthly reminder
  useMount(async () => {
    const plan = getCurrentPlan()
    if (plan.tier === 'free') {
      const lastReminder = await get<string>('lastLicenseReminder')
      const now = Date.now()
      const oneMonth = 30 * 24 * 60 * 60 * 1000

      if (!lastReminder || now - new Date(lastReminder).getTime() > oneMonth) {
        await set('lastLicenseReminder', new Date().toISOString())
        setShowLicense(true)
      }
    }
  })

  if (!store.email) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <a href={'https://mail.google.com/mail/u/0/#inbox'} target="_blank">
          <Button>Please login to Gmail</Button>
        </a>
      </div>
    )
  }

  return (
    <>
      {showLicense && <LicenseDialog onClose={() => setShowLicense(false)} onActivated={() => forceUpdate({})} />}
      {store.email && (
        <div>
          <Toolbar onShowLicense={() => setShowLicense(true)} />
          <MailList threads={store.threads} onSelectFeed={onSelectFeed} />
        </div>
      )}
    </>
  )
}

export function IndexPage() {
  const store = useMailStore()
  useEffectOnce(() => {
    popupMessager.onMessage('refreshPopup', () => store.refresh())
    store.refresh()
    return () => {
      popupMessager.removeAllListeners()
    }
  })
  return store.path === 'detail' ? <DetailPage /> : <HomePage />
}
