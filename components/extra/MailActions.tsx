import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { openMailInWeb } from '@/lib/api/gmail'
import { bgMessager, type GmailAction } from '@/lib/messager'
import type { EmailThread } from '@/lib/StateManager'
import { hasUnsubscribeLink } from '@/lib/unsubscribe'
import { mailQueryKey } from '@/lib/useMailQuery'
import { useQueryClient } from '@tanstack/react-query'
import { ArchiveIcon, BanIcon, ExternalLinkIcon, MailMinusIcon, MailOpenIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

// Every listed thread from this thread's sender, this one included.
export function urlsFromSender(threads: EmailThread[], thread: EmailThread): string[] {
  const sender = thread.author.email.toLowerCase()
  return threads.filter((it) => it.author.email.toLowerCase() === sender).map((it) => it.url)
}

// The per-mail actions, shared by the list row and the opened mail.
export function MailActions({ thread, senderUrls }: { thread: EmailThread; senderUrls: string[] }) {
  const queryClient = useQueryClient()
  async function gmailAction(
    cmd: Extract<GmailAction, { url: string }>['cmd'],
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
  async function unsubscribe(cleanup: 'archive' | 'deleteMail' | 'archiveAll' | 'deleteAll') {
    try {
      const kind = await bgMessager.sendMessage('unsubscribe', thread.url)
      if (kind === null) {
        toast.error('No unsubscribe option found')
        return
      }
      await removeFromSender(cleanup)
      toast.success(
        {
          post: 'Unsubscribed',
          open: 'Unsubscribe page opened',
          mail: 'Unsubscribe mail ready to send',
        }[kind],
      )
    } catch (err) {
      console.error(err)
      toast.error('Unsubscribe failed')
    }
  }
  async function removeFromSender(cmd: 'archive' | 'deleteMail' | 'archiveAll' | 'deleteAll') {
    await bgMessager.sendMessage(
      'gmailAction',
      cmd === 'archive' || cmd === 'deleteMail' ? { cmd, url: thread.url } : { cmd, urls: senderUrls },
    )
    await queryClient.invalidateQueries({ queryKey: mailQueryKey })
  }
  async function senderAction(cmd: 'archiveAll' | 'deleteAll') {
    const msg = `${cmd === 'archiveAll' ? 'Archive' : 'Delete'} ${senderUrls.length} mails`
    try {
      await removeFromSender(cmd)
      toast.success(msg)
    } catch (err) {
      console.error(err)
      toast.error(msg + ' failed')
    }
  }
  const othersFromSender = senderUrls.length > 1
  const canUnsubscribe = hasUnsubscribeLink(thread.messages.at(-1)?.contentHtml ?? '')
  return (
    <>
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
      {(canUnsubscribe || othersFromSender) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" title={canUnsubscribe ? 'Unsubscribe' : 'From this sender'}>
              <MailMinusIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={'end'}>
            {canUnsubscribe && (
              <>
                <DropdownMenuItem onClick={() => unsubscribe('archive')}>Unsubscribe and archive</DropdownMenuItem>
                <DropdownMenuItem onClick={() => unsubscribe('deleteMail')}>Unsubscribe and delete</DropdownMenuItem>
              </>
            )}
            {canUnsubscribe && othersFromSender && (
              <>
                <DropdownMenuItem onClick={() => unsubscribe('archiveAll')}>
                  Unsubscribe and archive all {senderUrls.length} from sender
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => unsubscribe('deleteAll')}>
                  Unsubscribe and delete all {senderUrls.length} from sender
                </DropdownMenuItem>
              </>
            )}
            {canUnsubscribe && othersFromSender && <DropdownMenuSeparator />}
            {othersFromSender && (
              <>
                <DropdownMenuItem onClick={() => senderAction('archiveAll')}>
                  Archive all {senderUrls.length} from sender
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => senderAction('deleteAll')}>
                  Delete all {senderUrls.length} from sender
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
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
    </>
  )
}
