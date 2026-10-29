import { Button } from '@/components/ui/button'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  clearNotificationSound,
  getNotificationSound,
  playSound,
  setNotificationSound,
} from '@/lib/sound'

const soundQueryKey = ['notificationSound']

export function SoundPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const soundQuery = useQuery({ queryKey: soundQueryKey, queryFn: getNotificationSound })
  const sound = soundQuery.data ?? null
  // Firefox closes the toolbar popup as soon as a file dialog opens, so the
  // picker only works in the standalone tab.
  const isTab = new URLSearchParams(location.search).get('view') === 'tab'

  async function pick(file: File | undefined) {
    if (!file) return
    try {
      const picked = await setNotificationSound(file)
      await queryClient.invalidateQueries({ queryKey: soundQueryKey })
      await playSound(picked)
      toast.success('Sound saved')
    } catch (err) {
      console.error(err)
      toast.error(String(err))
    }
  }

  async function turnOff() {
    await clearNotificationSound()
    await queryClient.invalidateQueries({ queryKey: soundQueryKey })
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex items-center px-4 py-2 bg-background shadow-sm border-b border-border gap-2 sticky top-0 z-10">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate({ to: '/' })}>
          <ArrowLeftIcon className="w-4 h-4" />
        </Button>
        <span className="font-medium text-foreground flex-1">Notification sound</span>
      </div>
      <div className="flex flex-col gap-3 p-4 text-sm">
        <p>
          Current: <span className="font-medium">{sound ? sound.name : 'none (system sound only)'}</span>
        </p>
        <div className="flex gap-2">
          {isTab ? (
            <Button asChild>
              <label>
                Choose sound file
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(ev) => pick(ev.target.files?.[0])}
                />
              </label>
            </Button>
          ) : (
            <Button
              onClick={() => {
                void browser.tabs.create({ url: browser.runtime.getURL('/popup.html?view=tab&page=/sound') })
                window.close()
              }}
            >
              Choose sound file
            </Button>
          )}
          {sound && (
            <>
              <Button variant="secondary" onClick={() => playSound(sound)}>
                Test
              </Button>
              <Button variant="secondary" onClick={turnOff}>
                Turn off
              </Button>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Plays when new mail arrives. To avoid two sounds, turn off "Play sound for notifications" for Firefox in
          macOS System Settings → Notifications.
        </p>
      </div>
    </div>
  )
}
