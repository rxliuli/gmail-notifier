import { Button } from '@/components/ui/button'
import { getOpenWebLink, openMailInWeb, ThreadMail } from '@/lib/api/gmail'
import { useMailStore } from '@/lib/mailStore'
import dayjs from 'dayjs'
import { ArrowLeftIcon, ExternalLinkIcon, PaperclipIcon, ChevronsUpDownIcon, ChevronsDownUpIcon } from 'lucide-react'
import { memo, useMemo, useRef } from 'react'
import root from 'react-shadow'
import { useCollapseStore } from '@/lib/collapseStore'
import { createStyleSheets } from '@/lib/addStyle'

const MailContent = memo((props: { contentHtml: string; styles: string[] }) => {
  const styleSheets = useMemo(() => createStyleSheets(props.styles), [props.styles])
  return (
    <root.div styleSheets={styleSheets}>
      <div dangerouslySetInnerHTML={{ __html: props.contentHtml }} style={{ overflowX: 'auto' }} />
    </root.div>
  )
})

// New: Collapsed messages count indicator component
const CollapsedMessagesIndicator = memo(
  (props: { count: number; startIndex: number; onExpand: (startIndex: number, count: number) => void }) => {
    const { count, startIndex, onExpand } = props

    return (
      <div
        data-testid="collapsed-indicator"
        data-count={count}
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
  styles: string[]
  collapsed: boolean
  onToggle: () => void
}) {
  const { message, styles, collapsed, onToggle } = props

  if (collapsed) {
    return (
      <div
        data-testid="mail-message"
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
    <div
      data-testid="mail-message"
      className="flex flex-col gap-3 px-4 py-3 border-b border-border last:border-b-0 bg-background rounded shadow-sm"
    >
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
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {dayjs(message.time).format('YYYY-MM-DD HH:mm')}
            </span>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            <div>To: {message.to.join(', ')}</div>
            {message.cc.length > 0 && <div>Cc: {message.cc.join(', ')}</div>}
          </div>
        </div>
      </div>
      {/* Email body */}
      <MailContent contentHtml={message.contentHtml} styles={styles} />
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

  const groupStartIndex = collapseStore.groupIndexes.size > 0 ? Math.min(...collapseStore.groupIndexes) : null

  return (
    <div className="flex flex-col min-h-screen">
      <DetailToolbar
        messageCount={messageCount}
        allCollapsed={collapseStore.hasCollapsed}
        onToggleAll={collapseStore.toggleAll}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="w-full">
          {thread.messages.map((message, i) => {
            if (collapseStore.groupIndexes.has(i)) {
              if (i === groupStartIndex) {
                return (
                  <CollapsedMessagesIndicator
                    key={`collapsed-indicator`}
                    count={collapseStore.groupIndexes.size}
                    startIndex={groupStartIndex!}
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
                styles={thread.styles}
                collapsed={collapseStore.contentIndexes.has(i)}
                onToggle={() => collapseStore.toggleContent(i)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// MailSender component removed - reply functionality requires user authentication
// which has been removed from this version. If you want to add reply functionality,
// consider implementing it using Gmail's web interface directly.

function DetailToolbar(props: { messageCount: number; allCollapsed: boolean; onToggleAll: () => void }) {
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
      {props.messageCount > 1 && (
        <Button
          size="icon"
          variant="ghost"
          title={props.allCollapsed ? 'All Collapsed' : 'All Expanded'}
          onClick={props.onToggleAll}
        >
          {props.allCollapsed ? <ChevronsUpDownIcon /> : <ChevronsDownUpIcon />}
        </Button>
      )}
      <Button size="icon" variant="ghost" title={'Open in Gmail'} onClick={() => openMailInWeb(thread.url)}>
        <ExternalLinkIcon />
      </Button>
    </div>
  )
}
