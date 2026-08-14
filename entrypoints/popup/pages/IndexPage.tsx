import { Button } from '@/components/ui/button'
import { openMailInWeb, newEmail, getActiveInboxUrl } from '@/lib/api/gmail'
import { bgMessager, type GmailAction } from '@/lib/messager'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { mailQueryKey, useMailQuery } from '@/lib/useMailQuery'
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
  BugIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { debugLog } from '@/lib/debugLog'
import { RefreshIcon } from '@/components/extra/RefreshIcon'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FaDiscord, FaGithub } from 'react-icons/fa'
import type { EmailThread } from '@/lib/StateManager'

function MailItem({
  thread,
  onClick,
}: {
  thread: EmailThread
  onClick: () => void
}) {
  const queryClient = useQueryClient()
  async function gmailAction(
    cmd: Exclude<GmailAction['cmd'], 'markAllAsRead'>,
    msg: string,
  ) {
    try {
      await bgMessager.sendMessage('gmailAction', {
        cmd,
        url: thread.url,
      })
      await queryClient.invalidateQueries({ queryKey: mailQueryKey })
      toast.success(msg)
    } catch (err) {
      console.error(err)
      toast.error(msg + ' failed')
    }
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
          <div
            className="flex gap-1 group-hover:flex hidden"
            onClick={(ev) => ev.stopPropagation()}
          >
            <Button
              size="icon"
              variant="ghost"
              title={'Archive'}
              onClick={() => gmailAction('archive', 'Archive')}
            >
              <ArchiveIcon />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title={'Trash'}
              onClick={() => gmailAction('deleteMail', 'Delete')}
            >
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
            <Button
              size="icon"
              variant="ghost"
              title={'Open in Gmail'}
              onClick={() => openMailInWeb(thread.url)}
            >
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
  const navigate = useNavigate()
  const mailQuery = useMailQuery()
  const queryClient = useQueryClient()
  const refreshMutation = useMutation({
    // Don't rely solely on background's 'refreshPopup' push to update this
    // view - that only reaches us if our keepalive port happens to still be
    // connected the instant background finishes (it disconnects/reconnects
    // often on Safari), so a message landing mid-gap is silently lost and
    // the button does nothing until the popup is closed and reopened. Pull
    // directly once our own request is known to have completed instead.
    mutationFn: async () => {
      await bgMessager.sendMessage('refreshThreads', undefined)
      await queryClient.invalidateQueries({ queryKey: mailQueryKey })
    },
  })

  async function markAllAsRead(msg: string) {
    try {
      await bgMessager.sendMessage('gmailAction', {
        cmd: 'markAllAsRead',
        urls: (mailQuery.data?.threads ?? []).map((t) => t.url),
      })
      await queryClient.invalidateQueries({ queryKey: mailQueryKey })
      toast.success(msg)
    } catch (err) {
      console.error(err)
      toast.error(msg + ' failed')
    }
  }

  return (
    <div className="flex items-center px-4 py-2 bg-card shadow-sm border-b border-border gap-2 sticky top-0 z-10">
      {/* Gmail icon */}
      <div className="flex items-center">
        <img src="/icon/48.png" alt="Gmail Notifier" className="w-6 h-6" />
      </div>
      <span className="font-medium text-foreground flex-1">
        {mailQuery.data?.email ? `${mailQuery.data.email} (${mailQuery.data.threads.length})` : 'Gmail Notifier'}
      </span>
      {(mailQuery.data?.threads.length ?? 0) > 0 && (
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
        className={cn(
          'h-8 w-8',
          refreshMutation.isPending &&
            'animate-spin pointer-events-none opacity-50',
        )}
        onClick={() => refreshMutation.mutate()}
        disabled={refreshMutation.isPending}
      >
        <RefreshIcon loading={refreshMutation.isPending} />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        title={'Open in Gmail'}
        onClick={async () => openMailInWeb(await getActiveInboxUrl())}
      >
        <ExternalLinkIcon />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        title={'New email'}
        onClick={newEmail}
      >
        <MailPlusIcon />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" title={'More'}>
            <MoreVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={'end'}>
          <DropdownMenuItem asChild>
            {/* Not a hardcoded chrome-extension:// URL: Safari's own
                extension resources live under safari-web-extension://, not
                chrome-extension://, so that scheme opened a blank tab there
                (the browser doesn't recognize it). getURL() returns
                whatever scheme+id the current browser actually uses.

                The ?view=tab marker is what main.tsx reads to skip applying
                either fixed-size popup class - a standalone tab should
                never be size-constrained the way the actual toolbar popup
                needs to be. */}
            <a href={browser.runtime.getURL('/popup.html?view=tab')} target="_blank">
              <SquareArrowOutUpRightIcon />
              Popout
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: '/debug' })}>
            <BugIcon />
            Debug Log
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href="https://discord.gg/gFhKUthc88" target="_blank">
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

function MailList({
  threads,
  onSelectFeed,
}: {
  threads: EmailThread[]
  onSelectFeed: (thread: EmailThread) => void
}) {
  return (
    <div className="w-full">
      {threads.map((thread) => (
        <MailItem
          key={thread.url}
          thread={thread}
          onClick={() => onSelectFeed(thread)}
        />
      ))}
    </div>
  )
}

export function IndexPage() {
  const navigate = useNavigate()
  const mailQuery = useMailQuery()

  async function onSelectFeed(thread: EmailThread) {
    // Diagnostic for the click-kills-the-popup bug: timestamps the click and
    // identifies which thread was clicked, so a teardown moments later can be
    // matched to the exact email (still retrievable in Gmail - it only got
    // marked read, not deleted).
    void debugLog('popup: mail clicked ->', thread.url)
    navigate({ to: '/detail/$threadUrl', params: { threadUrl: encodeURIComponent(thread.url) } })
    if (import.meta.env.PROD) {
      await bgMessager.sendMessage('gmailAction', {
        cmd: 'viewed',
        url: thread.url,
      })
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Toolbar />
      <div
        className={cn(
          'flex-1',
          // Centering a child via h-full/100% here doesn't actually work -
          // confirmed live in DevTools that h-full resolved to 36px (its own
          // content height) instead of this element's real, DevTools-
          // confirmed 331px. A flex item's flex-grow-resolved size isn't
          // reliably treated as a definite height for a descendant's
          // percentage height to resolve against. Centering directly on
          // this element instead - which does have a real resolved height -
          // sidesteps that entirely, no percentage resolution involved.
          !mailQuery.data?.email && 'flex flex-col items-center justify-center',
        )}
      >
        {mailQuery.data?.email ? (
          <MailList threads={mailQuery.data.threads} onSelectFeed={onSelectFeed} />
        ) : (
          <a href={'https://mail.google.com/mail/u/0/#inbox'} target="_blank">
            <Button>Please login to Gmail</Button>
          </a>
        )}
      </div>
    </div>
  )
}
