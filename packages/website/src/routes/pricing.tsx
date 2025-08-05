import { Check } from 'lucide-react'
import { ClientOnly, createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '~/components/ui/button'
import { UpgradeToPro } from '~/components/UpgradeToPro'

export const Route = createFileRoute('/pricing')({
  component: Pricing,
})

function Pricing() {
  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Simple, Transparent Pricing</h1>
        <p className="text-xl text-muted-foreground">Start with a 14-day free trial. No credit card required.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Free Trial */}
        <div className="border rounded-2xl p-8 flex flex-col justify-between gap-y-6">
          <div>
            <h2 className="text-2xl font-bold">Free Trial</h2>
            <p className="text-muted-foreground">Try all features for 14 days</p>
          </div>
          <div className="space-y-2 mb-auto">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              <span>All features included</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              <span>Cancel anytime</span>
            </div>
          </div>
          <Link
            to="/login"
            className="block w-full text-center bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90"
          >
            Start Free Trial
          </Link>
        </div>

        {/* Annual Plan */}
        <div className="border rounded-2xl p-8 space-y-6 bg-accent/50">
          <div>
            <h2 className="text-2xl font-bold">Annual Plan</h2>
            <p className="text-muted-foreground">After the free trial</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              <span>All features included</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              <span>Priority support</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              <span>Early access to new features</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold">$19.99</div>
            <p className="text-muted-foreground">per year</p>
          </div>
          <ClientOnly
            fallback={
              <Button size={'lg'} className="w-full">
                Subscribe Now
              </Button>
            }
          >
            <UpgradeToPro />
          </ClientOnly>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="space-y-8">
        <h2 className="text-2xl font-bold text-center">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">What happens after the free trial?</h3>
            <p className="text-muted-foreground">
              After the 14-day free trial, you'll need to subscribe to continue using the service. We'll notify you
              before the trial ends.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Can I cancel my subscription?</h3>
            <p className="text-muted-foreground">
              Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your
              billing period.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Is my data secure?</h3>
            <p className="text-muted-foreground">
              Yes, we take security seriously. The extension is open source, so you can verify exactly how your data is
              handled.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
