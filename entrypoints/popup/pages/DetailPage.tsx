import { Button } from '@/components/ui/button'
import { getOpenWebLink, openMailInWeb, type ThreadMail } from '@/lib/api/gmail'
import { useMailQuery } from '@/lib/useMailQuery'
import type { EmailThread } from '@/lib/StateManager'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { ArrowLeftIcon, ExternalLinkIcon, PaperclipIcon, ChevronsUpDownIcon, ChevronsDownUpIcon } from 'lucide-react'
import { memo, useEffect, useMemo } from 'react'
import root from 'react-shadow'
import { useCollapseStore } from '@/lib/collapseStore'
import { createStyleSheets } from '@/lib/addStyle'

// Not importing detailRoute directly from router.tsx: that file imports
// this one (as the route's component), so a direct import would be
// circular. getRouteApi() looks the route up by its string id instead.
const detailRouteApi = getRouteApi('/detail/$threadUrl')

// react-shadow's `root` is proxied via an index signature, which under
// noUncheckedIndexedAccess types every property access as possibly
// undefined even though the proxy always returns a component.
const ShadowDiv = root.div as NonNullable<typeof root.div>

// Raw email HTML almost never sets its own text color (it relies on the
// browser default, black) - but `color` is an inherited property that
// crosses shadow boundaries by default, so with nothing resetting it here,
// unstyled email text was inheriting straight through from our OWN app
// chrome's `body { color: var(--foreground) }`. In dark mode --foreground is
// near-white (correct for our UI, meant to sit on our dark background) -
// confirmed live via DevTools computed styles showing an unstyled <pre> at
// oklch(0.985 0 0). Piping that near-white value through the invert() below
// (built for content starting from the browser's actual black default) flips
// it to near-black-on-black, and the text disappears entirely regardless of
// how the invert/brightness math is tuned. Pinning an explicit black here -
// not `initial`/`canvastext`, which the ancestor's `color-scheme: dark` can
// silently reinterpret as white - cuts that inheritance off at the shadow
// boundary so unstyled text always starts from the same baseline a normal
// browser gives it. Anything the email DOES style explicitly (inline color,
// its own <style> rules) still overrides this via normal cascade specificity.
const BASE_RESET_STYLE = `
  :host {
    color: #000;
  }
`

// Emails ship their own (usually light, white-background) styling, which we
// don't control. Inverting lightness while rotating hue back is the standard
// trick browsers' own "force dark" modes use to make arbitrary HTML readable
// on a dark background; re-inverting img/video cancels it out so photos and
// logos aren't rendered as photonegatives.
//
// Low-contrast text (light gray "secondary info" on white, common for fine
// print / error details) needs extra help: invert() alone preserves the
// original color distance, so text that was barely legible on white becomes
// barely legible on black instead of actually improving.
//
// brightness(), not contrast(), fixes that gap: the host background is
// forced to white, so after invert() it's pinned at pure black (0), where
// brightness's multiply-by-b leaves it unchanged (0 * b = 0) - only the
// non-zero text lightens. contrast() looks like the obvious tool for "low
// contrast text" but is wrong here: it pivots around 50% gray, and inverted
// light-gray text already lands below that pivot (same side as the black
// background), so contrast pushes it *toward* black too, shrinking the gap
// instead of widening it - confirmed live, it made previously-faint text
// disappear entirely.
const DARK_MODE_BRIGHTNESS = 1.5

// Wrapped in the media query itself rather than picked in JS - the whole
// point of moving off next-themes is that dark mode is now purely a system
// preference the browser applies on its own, so this rule only needs to be
// present in the stylesheet, never conditionally included.
const DARK_MODE_FILTER_STYLE = `
  @media (prefers-color-scheme: dark) {
    :host {
      filter: invert(1) hue-rotate(180deg) brightness(${DARK_MODE_BRIGHTNESS});
      background: white;
    }
    img, video {
      /* Order matters here, and it's the opposite of what's intuitive: the
         brightness cancellation has to run BEFORE invert/hue-rotate, not
         after. brightness() is a plain per-channel multiply (no pivot,
         unlike contrast()), so multiplying by its exact reciprocal is a
         true inverse - but only if it stays outside the two invert/
         hue-rotate pairs. Those two pairs are each self-inverse and cancel
         to identity ONLY when they sit immediately adjacent (host's
         invert/hue-rotate right after this element's); sandwiching a
         brightness multiply between them (i.e. after this element's
         invert/hue-rotate) breaks that adjacency and the cancellation math
         no longer works out, leaving photos visibly tinted. Putting it
         first keeps both pairs adjacent and cancels exactly, so photos/
         logos render at their original brightness. */
      filter: brightness(${1 / DARK_MODE_BRIGHTNESS}) invert(1) hue-rotate(180deg);
    }
  }
`

const MailContent = memo((props: { contentHtml: string; styles: string[] }) => {
  const styleSheets = useMemo(() => {
    return createStyleSheets([BASE_RESET_STYLE, ...props.styles, DARK_MODE_FILTER_STYLE])
  }, [props.styles])
  return (
    <ShadowDiv styleSheets={styleSheets}>
      <div dangerouslySetInnerHTML={{ __html: props.contentHtml }} style={{ overflowX: 'auto' }} />
    </ShadowDiv>
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
  const { threadUrl } = detailRouteApi.useParams()
  const navigate = useNavigate()
  const mailQuery = useMailQuery()
  const thread = mailQuery.data?.threads.find((t) => t.url === decodeURIComponent(threadUrl))

  const messageCount = thread?.messageCount ?? 0
  const collapseStore = useCollapseStore()
  // Not called inline in the render body: thread now arrives async (via
  // useMailQuery, not a synchronously-set store value), so DetailPage
  // legitimately renders once before it resolves - calling a store setter
  // mid-render for that first, pre-thread pass triggered React's "Cannot
  // update a component while rendering a different component" warning.
  useEffect(() => {
    collapseStore.setCount(messageCount)
  }, [messageCount])

  useEffect(() => {
    // The thread this route points at isn't in the list (e.g. archived/
    // deleted from elsewhere, or removed on the next refresh) - once the
    // query has actually resolved, nothing sensible is left to show here.
    if (mailQuery.data && !thread) {
      navigate({ to: '/' })
    }
  }, [mailQuery.data, thread, navigate])

  if (!thread) {
    return <></>
  }

  const groupStartIndex = collapseStore.groupIndexes.size > 0 ? Math.min(...collapseStore.groupIndexes) : null

  return (
    <div className="flex flex-col min-h-screen">
      <DetailToolbar
        thread={thread}
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

function DetailToolbar(props: {
  thread: EmailThread
  messageCount: number
  allCollapsed: boolean
  onToggleAll: () => void
}) {
  const navigate = useNavigate()
  const { thread } = props
  return (
    <div className="flex items-center px-4 py-2 bg-background shadow-sm border-b border-border gap-2 sticky top-0 z-10">
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate({ to: '/' })}>
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
