import { createFileRoute } from '@tanstack/react-router'
import RefundPolicy from './docs/refund.md?react'

export const Route = createFileRoute('/refund')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="min-h-[80vh] max-w-4xl mx-auto prose dark:prose-invert">
      <RefundPolicy />
    </div>
  )
}
