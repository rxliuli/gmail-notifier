import { createFileRoute } from '@tanstack/react-router'
import PrivacyPolicy from './docs/privacy.md?react'

export const Route = createFileRoute('/privacy')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="min-h-[80vh] max-w-4xl mx-auto prose dark:prose-invert">
      <PrivacyPolicy />
    </div>
  )
}
