import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getOpenWebLink, openMailInWeb, parseReplyTo, ThreadMail } from '@/lib/api/gmail'
import { useMailStore } from '@/lib/mailStore'
import dayjs from 'dayjs'
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  PaperclipIcon,
  ChevronsUpDownIcon,
  ChevronsDownUpIcon,
  SendIcon,
  Loader2Icon,
} from 'lucide-react'
import { memo, useState, useCallback, useRef } from 'react'
import root from 'react-shadow'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { encodeRFC2047, generateAccessToken, getMessage, replyEmail } from '@/lib/api/gcp'
import { cleanAuth, getAccessToken, getUser, login, setAccessToken } from '@/lib/auth'
import { useCollapseStore } from '@/lib/collapseStore'

const MailContent = memo((props: { contentHtml: string }) => (
  <root.div>
    <div dangerouslySetInnerHTML={{ __html: props.contentHtml }} style={{ overflowX: 'auto' }} />
  </root.div>
))

// New: Collapsed messages count indicator component
const CollapsedMessagesIndicator = memo(
  (props: { count: number; startIndex: number; onExpand: (startIndex: number, count: number) => void }) => {
    const { count, startIndex, onExpand } = props

    return (
      <div
        className="flex items-center justify-center py-1 cursor-pointer hover:bg-accent/30 transition-colors border-b border-border"
        onClick={() => onExpand(startIndex, count)}
      >
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
          <div className="w-6 h-6 flex items-center justify-center rounded-full bg-primary/20 border border-primary/30 text-primary font-medium text-xs">
            {count}
          </div>
          <span>messages collapsed</span>
          <ChevronsUpDownIcon className="w-3 h-3" />
        </div>
      </div>
    )
  },
)

const MailMessage = function MailMessage(props: {
  message: ThreadMail['messages'][number]
  collapsed: boolean
  onToggle: () => void
}) {
  const { message, collapsed, onToggle } = props

  if (collapsed) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 bg-background rounded shadow-sm cursor-pointer hover:bg-accent"
        onClick={onToggle}
      >
        {/* Avatar */}
        <div className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold">
          {message.senderName.charAt(0)}
        </div>
        {/* Sender info and summary */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">{message.senderName}</span>
            <time
              dateTime={dayjs(message.time).toISOString()}
              title={dayjs(message.time).format('YYYY-MM-DD hh:mm:ss')}
              className="text-xs text-muted-foreground ml-2"
            >
              {dayjs(message.time).format('YYYY-MM-DD hh:mm')}
            </time>
          </div>
          <div className="text-sm text-muted-foreground truncate mt-1">{message.contentText}</div>
        </div>
      </div>
    )
  }
  // Show full content when expanded
  return (
    <div className="flex flex-col gap-3 px-4 py-3 border-b border-border last:border-b-0 bg-background rounded shadow-sm">
      {/* Email header */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold">
          {message.senderName.charAt(0)}
        </div>
        {/* Sender info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-foreground">{message.senderName}</span>
              <span className="text-muted-foreground ml-2">&lt;{message.senderEmail}&gt;</span>
            </div>
            <span className="text-xs text-muted-foreground">{dayjs(message.time).format('YYYY-MM-DD HH:mm')}</span>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            <div>To: {message.to.join(', ')}</div>
            {message.cc.length > 0 && <div>Cc: {message.cc.join(', ')}</div>}
          </div>
        </div>
      </div>
      {/* Email body */}
      <MailContent contentHtml={message.contentHtml} />
      {/* Attachments */}
      {message.attachments && message.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {message.attachments.map((attachment) => (
            <a
              key={attachment.url}
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground bg-muted rounded hover:bg-accent"
            >
              <PaperclipIcon className="w-3 h-3" />
              <span className="truncate max-w-[200px]">{attachment.fileName}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

export function DetailPage() {
  const store = useMailStore()
  const messageCount = store.thread?.messageCount ?? 0
  const lastMessageCount = useRef(0)

  const collapseStore = useCollapseStore()
  if (lastMessageCount.current !== messageCount) {
    collapseStore.setCount(messageCount)
    lastMessageCount.current = messageCount
  }

  const thread = store.thread
  if (!thread) {
    return <></>
  }

  return (
    <div className="flex flex-col min-h-screen">
      <DetailToolbar allCollapsed={collapseStore.hasCollapsed} onToggleAll={collapseStore.toggleAll} />
      <div className="flex-1 overflow-y-auto">
        <div className="w-full">
          {thread.messages.map((message, i) => {
            if (collapseStore.groupIndexes.has(i)) {
              if (i === 3) {
                return (
                  <CollapsedMessagesIndicator
                    key={`collapsed-indicator`}
                    count={messageCount - 3}
                    startIndex={3}
                    onExpand={() => collapseStore.expandGroup()}
                  />
                )
              }
              return null
            }
            return (
              <MailMessage
                key={`${message.senderEmail}-${message.time}-${i}`}
                message={message}
                collapsed={collapseStore.contentIndexes.has(i)}
                onToggle={() => collapseStore.toggleContent(i)}
              />
            )
          })}
        </div>
      </div>
      {/* <MailSender /> */}
    </div>
  )
}

function MailSender() {
  const store = useMailStore()
  const thread = store.thread!
  const [message, setMessage] = useState('')

  const sendMailMutation = useMutation({
    mutationFn: async (content: string) => {
      const user = await getUser()
      if (!user?.token) {
        throw new Error('User not found')
      }
      const messageId = new URL(thread.url).searchParams.get('message_id')
      if (!messageId) {
        throw new Error('Message ID not found')
      }
      const to = thread.messages.find((it) => it.senderEmail !== user.email)
      if (!to) {
        throw new Error('No reply to email found')
      }
      let accessToken = await getAccessToken()
      if (!accessToken || new Date(accessToken.expiresAt) < new Date()) {
        const accessToken = await generateAccessToken(user.token)
        await setAccessToken(accessToken)
      }
      accessToken = await getAccessToken()
      if (!accessToken) {
        throw new Error('No access token found')
      }
      const message = await getMessage({
        accessToken: accessToken.accessToken,
        messageId: messageId,
      })
      const inReplyTo = message.payload.headers.find((it) => it.name === 'In-Reply-To')?.value
      const references = message.payload.headers.find((it) => it.name === 'References')?.value
      if (!inReplyTo || !references) {
        throw new Error('No in reply to or references found')
      }
      const resp = await replyEmail({
        accessToken: accessToken.accessToken,
        messageId: messageId,
        subject: thread.subject,
        content,
        from: user.name ? `${encodeRFC2047(user.name)} <${user.email}>` : user.email,
        to: to.senderName ? `${encodeRFC2047(to.senderName)} <${to.senderEmail}>` : to.senderEmail,
        inReplyTo: inReplyTo,
        references: references,
        threadId: message.threadId,
      })
      if (resp.status !== 200) {
        throw new Error('Send mail failed')
      }
      return { success: true }
    },
    onSuccess: () => {
      setMessage('')
      toast.success('Send mail success')
    },
    onError: (err) => {
      if (err instanceof Response) {
        if (err.status === 401) {
          toast.info('Please login again', {
            action: {
              label: 'Login',
              onClick: async () => {
                await cleanAuth()
                login('consent')
              },
            },
          })
          return
        }
      }
      console.error('Send mail failed', err)
      toast.error('Send mail failed')
    },
  })

  function handleSend() {
    if (!message.trim()) {
      return
    }
    sendMailMutation.mutate(message.trim())
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const isDisabled = sendMailMutation.isPending || !message.trim()

  const inputRef = useRef<HTMLInputElement>(null)
  async function onFoucs() {
    const user = await getUser()
    console.log('user', user)
    if (user) {
      return
    }
    inputRef.current?.blur()
    toast.info('You need to login first to reply', {
      action: {
        label: 'Login',
        onClick: async () => {
          await cleanAuth()
          login('consent')
        },
      },
    })
  }

  return (
    <div className="sticky bottom-0 bg-background border-t border-border p-3">
      <div className="flex gap-3 items-end">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Input reply content... (Cmd/Ctrl + Enter to send)"
          className="min-h-[50px] max-h-[100px] flex-1"
          disabled={sendMailMutation.isPending}
          ref={inputRef}
          onFocus={onFoucs}
        />
        <Button
          onClick={handleSend}
          disabled={isDisabled}
          size="icon"
          className="h-[50px] w-[50px] shrink-0 rounded-full"
        >
          {sendMailMutation.isPending ? (
            <Loader2Icon className="h-4 w-4 animate-spin" />
          ) : (
            <SendIcon className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}

function DetailToolbar(props: { allCollapsed: boolean; onToggleAll: () => void }) {
  const store = useMailStore()
  const thread = store.thread!
  return (
    <div className="flex items-center px-4 py-2 bg-background shadow-sm border-b border-border gap-2 sticky top-0 z-10">
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={store.back}>
        <ArrowLeftIcon className="w-4 h-4" />
      </Button>
      <a
        className="font-medium text-foreground flex-1"
        href={getOpenWebLink(thread.url)}
        title="Open in Gmail"
        onClick={(ev) => {
          ev.preventDefault()
          openMailInWeb(thread.url)
        }}
      >
        {thread.subject} ({thread.messageCount})
      </a>
      <Button
        size="icon"
        variant="ghost"
        title={props.allCollapsed ? 'All Collapsed' : 'All Expanded'}
        onClick={props.onToggleAll}
      >
        {props.allCollapsed ? <ChevronsUpDownIcon /> : <ChevronsDownUpIcon />}
      </Button>
      <Button size="icon" variant="ghost" title={'Open in Gmail'} onClick={() => openMailInWeb(thread.url)}>
        <ExternalLinkIcon />
      </Button>
    </div>
  )
}
