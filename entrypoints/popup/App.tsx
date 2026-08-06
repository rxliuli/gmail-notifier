import { IndexPage } from './pages/IndexPage'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShadowProvider } from '@/integrations/shadow/ShadowProvider'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/integrations/theme/ThemeProvider'

const queryClient = new QueryClient()

function App() {
  return (
    <ShadowProvider container={document.body}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Toaster richColors={true} closeButton={true} />
          <IndexPage />
        </ThemeProvider>
      </QueryClientProvider>
    </ShadowProvider>
  )
}

export default App
