import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { User, CreditCard, LogOut } from 'lucide-react'
import { getLocalUser, useLocalUser } from '~/lib/useAuth'
import type { MeResponse } from '@gmail-notifier/server'
import 'dayjs/plugin/duration'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { Button } from '~/components/ui/button'
import { toast } from 'sonner'

export const Route = createFileRoute('/settings')({
  component: Settings,
})

function Settings() {
  const { logout } = useLocalUser()
  const router = useRouter()
  const query = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const user = getLocalUser()
      if (!user) {
        router.navigate({ to: '/login' })
        throw new Error('User not found')
      }
      const resp = await fetch('/api/v1/auth/me', {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      })
      return (await resp.json()) as MeResponse
    },
  })
  const subscription = useMemo(() => {
    if (!query.data) {
      return null
    }
    const duration = dayjs(query.data.currentPeriodEnd).diff(dayjs(), 'day')
    const statusMap: Record<MeResponse['status'], string> = {
      trialing: 'Free Trial',
      active: 'Active',
      canceled: 'Canceled',
      expired: 'Expired',
    }
    return {
      status: duration >= 0 ? statusMap[query.data.status] : 'Expired',
      daysRemaining: duration,
    }
  }, [query.data])
  const cancelSubscription = useMutation({
    mutationFn: async () => {
      const user = getLocalUser()
      if (!user) {
        throw new Error('User not found')
      }
      const resp = await fetch('/api/v1/billing/cancel', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      })
      if (!resp.ok) {
        throw new Error('Failed to cancel subscription')
      }
      toast.success('Subscription canceled, you will still have access until the end of the current period.')
      query.refetch()
    },
    onError: (error) => {
      console.error('Failed to cancel subscription', error)
      toast.error('Failed to cancel subscription')
    },
  })
  const reactivateSubscription = useMutation({
    mutationFn: async () => {
      const user = getLocalUser()
      if (!user) {
        throw new Error('User not found')
      }
      const resp = await fetch('/api/v1/billing/reactivate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      })
      if (!resp.ok) {
        throw new Error('Failed to reactivate subscription')
      }
      toast.success('Subscription reactivated')
      query.refetch()
    },
    onError: (error) => {
      console.error('Failed to reactivate subscription', error)
      toast.error('Failed to reactivate subscription')
    },
  })
  return (
    <div className="min-h-[80vh] max-w-4xl mx-auto space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground">Manage your account and subscription</p>
      </div>

      <div className="grid gap-8">
        {/* Account Information */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Account Information</h2>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">Email</h3>
              <p className="text-sm text-muted-foreground">{query.data?.email}</p>
            </div>
            <div>
              <h3 className="font-medium">Subscription Status</h3>
              <p className="text-sm text-muted-foreground">
                {subscription?.daysRemaining && subscription.daysRemaining >= 0
                  ? `${subscription?.status} (${subscription?.daysRemaining} days remaining)`
                  : `${subscription?.status}`}
              </p>
            </div>
          </div>
        </section>

        {/* Subscription Management */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Subscription</h2>
          </div>
          <div className="space-y-4">
            {subscription?.daysRemaining && subscription?.daysRemaining < 0 ? (
              <Link to="/pricing">
                <Button>Subscribe</Button>
              </Link>
            ) : query.data?.status === 'active' ? (
              <Button variant={'destructive'} onClick={() => cancelSubscription.mutate()}>
                Cancel Subscription
              </Button>
            ) : query.data?.status === 'canceled' ? (
              <Button onClick={() => reactivateSubscription.mutate()}>Reactivate Subscription</Button>
            ) : (
              <Link to="/pricing">
                <Button>Subscribe</Button>
              </Link>
            )}
          </div>
        </section>

        {/* Sign Out */}
        <section className="pt-6 border-t">
          <button className="flex items-center gap-2 text-destructive hover:text-destructive/90" onClick={logout}>
            <LogOut className="h-5 w-5" />
            <span>Sign Out</span>
          </button>
        </section>
      </div>
    </div>
  )
}
