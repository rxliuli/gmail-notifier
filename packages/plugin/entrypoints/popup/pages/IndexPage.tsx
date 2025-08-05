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
import { FaDiscord, FaGithub, FaGoogle } from 'react-icons/fa'
import { EmailThread } from '@/lib/StateManager'
import { useAsync, useEffectOnce } from 'react-use'
import { getUser, login, logout } from '@/lib/auth'

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

function Toolbar() {
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

  const userState = useAsync(getUser)

  return (
    <div className="flex items-center px-4 py-2 bg-card shadow-sm border-b border-border gap-2 sticky top-0 z-10">
      {/* Gmail icon */}
      <div className="flex items-center mr-2">
        <svg viewBox="0 0 40 40" width="28" height="28">
          <g>
            <path fill="#EA4335" d="M4 32V8a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
            <path fill="#FFF" d="M32 8H8v24h24V8z" />
            <path
              fill="#EA4335"
              d="M32 8v24H8V8h24m0-2H8a2 2 0 0 0-2 2v24a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z"
            />
            <path fill="#34A853" d="M8 8l12 9 12-9v2l-12 9-12-9V8z" />
            <path fill="#FBBC05" d="M8 32V8l12 9 12-9v24H8z" />
            <path fill="#4285F4" d="M32 32V8l-12 9-12-9v24h24z" />
          </g>
        </svg>
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
          {userState.value?.id ? (
            <DropdownMenuItem onClick={logout}>{userState.value.email} Logout</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => login()}>
              <FaGoogle />
              Login
            </DropdownMenuItem>
          )}
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

function HomePage() {
  const store = useMailStore()
  async function onSelectFeed(thread: EmailThread) {
    store.go(thread)
    await bgMessager.sendMessage('gmailAction', {
      cmd: 'viewed',
      url: thread.url,
    })
  }
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
      {store.email && (
        <div>
          <Toolbar />
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
