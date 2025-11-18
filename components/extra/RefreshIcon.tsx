import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RefreshIconProps {
  loading: boolean
  className?: string
}

export function RefreshIcon({ loading, className }: RefreshIconProps) {
  const [isCompleting, setIsCompleting] = useState(false)

  useEffect(() => {
    if (!loading && isCompleting) {
      const timer = setTimeout(() => {
        setIsCompleting(false)
      }, 500)

      return () => clearTimeout(timer)
    }

    if (loading) {
      setIsCompleting(true)
    }
  }, [loading, isCompleting])

  return (
    <RefreshCw
      className={cn(
        'transition-transform duration-300 ease-out',
        {
          'animate-spin': loading,
          'animate-spin-complete': !loading && isCompleting,
        },
        className,
      )}
    />
  )
}
