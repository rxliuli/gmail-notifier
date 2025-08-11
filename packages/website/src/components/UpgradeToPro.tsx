import { useLocalUser } from '~/lib/useAuth'
import { Button } from './ui/button'
import { initializePaddle, Paddle } from '@paddle/paddle-js'
import { useTheme } from '~/integrations/theme/ThemeProvider'
import { useRouter } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { MeResponse } from '@gmail-notifier/server'

export function UpgradeToPro() {
  const { user, login } = useLocalUser()
  const { resolvedTheme } = useTheme()
  const router = useRouter()

  async function handleCheckoutCompleted(paddle: Paddle) {
    const endTime = Date.now() + 10 * 1000
    while (Date.now() < endTime) {
      const resp = await fetch('/api/v1/auth/me', {
        headers: {
          Authorization: `Bearer ${user?.token}`,
        },
      })
      if (!resp.ok) {
        alert('Subscription failed')
        return
      }
      const data = (await resp.json()) as MeResponse
      if (data.status === 'active') {
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    alert('Subscription successful')
    paddle?.Checkout.close()
    router.navigate({ to: '/settings' })
  }

  async function handleUpgrade() {
    if (!user) {
      const confirmed = confirm('Please login to subscribe')
      if (!confirmed) {
        return
      }
      login()
      return
    }
    if (user.status === 'active') {
      alert('You are already subscribed')
      return
    }
    const resp = await fetch('/api/v1/auth/me', {
      headers: {
        Authorization: `Bearer ${user?.token}`,
      },
    })
    if (!resp.ok) {
      const confirmed = confirm('Please login to subscribe')
      if (!confirmed) {
        return
      }
      login()
      return
    }

    const paddle = await initializePaddle({
      environment: import.meta.env.VITE_PADDLE_ENVIRONMENT,
      token: import.meta.env.VITE_PADDLE_CLIENT_TOKEN,
      async eventCallback(event) {
        console.log('event', event)

        if (event.name === 'checkout.completed' && event.data) {
          await handleCheckoutCompleted(paddle!)
        }
      },
      pwCustomer: {
        id: user.id,
        email: user.email,
      },
      checkout: {
        settings: {
          theme: resolvedTheme === 'dark' ? 'dark' : 'light',
          locale: 'en',
        },
      },
    })
    if (!paddle) {
      throw new Error('Failed to initialize Paddle')
    }
    paddle.Checkout.open({
      items: [
        {
          priceId: import.meta.env.VITE_PADDLE_PRICE_ID,
          quantity: 1,
        },
      ],
      customer: {
        email: user.email,
      },
      customData: {
        userId: user.id,
        email: user.email,
      },
    })
  }
  return user &&
    (user.status === 'active' || user.status === 'canceled') &&
    user.currentPeriodEnd &&
    user.currentPeriodEnd > new Date().toISOString() ? (
    <Button size={'lg'} className="w-full" disabled={true}>
      Subscribed
    </Button>
  ) : (
    <Button size={'lg'} className="w-full" onClick={handleUpgrade}>
      Subscribe Now
    </Button>
  )
}
