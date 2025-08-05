import { createFileRoute } from '@tanstack/react-router'
import TermsOfService from './docs/terms.md?react'

export const Route = createFileRoute('/terms')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="min-h-[80vh] max-w-4xl mx-auto prose dark:prose-invert">
      <TermsOfService />
    </div>
  )
}
