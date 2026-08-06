import { Button } from '@/components/ui/button'
import { useNavigate } from '@tanstack/react-router'
import { clearDebugLogs, getDebugLogs } from '@/lib/debugLog'
import { ArrowLeftIcon, CopyIcon, RotateCwIcon, Trash2Icon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export function DebugLogPage() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState<string[]>([])

  async function load() {
    setLogs(await getDebugLogs())
  }

  useEffect(() => {
    load()
  }, [])

  async function copy() {
    await navigator.clipboard.writeText(logs.join('\n'))
    toast.success('Copied to clipboard')
  }

  async function clear() {
    await clearDebugLogs()
    await load()
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex items-center px-4 py-2 bg-background shadow-sm border-b border-border gap-2 sticky top-0 z-10">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate({ to: '/' })}>
          <ArrowLeftIcon className="w-4 h-4" />
        </Button>
        <span className="font-medium text-foreground flex-1">Debug Log ({logs.length})</span>
        <Button size="icon" variant="ghost" title="Refresh" onClick={load}>
          <RotateCwIcon />
        </Button>
        <Button size="icon" variant="ghost" title="Copy" onClick={copy}>
          <CopyIcon />
        </Button>
        <Button size="icon" variant="ghost" title="Clear" onClick={clear}>
          <Trash2Icon />
        </Button>
      </div>
      <pre className="flex-1 overflow-auto p-4 text-xs whitespace-pre-wrap break-all">
        {logs.length > 0 ? logs.join('\n') : 'No log entries yet.'}
      </pre>
    </div>
  )
}
