import { IndexPage } from './pages/IndexPage'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShadowProvider } from '@/integrations/shadow/ShadowProvider'
import { Toaster } from '@/components/ui/sonner'

const queryClient = new QueryClient()

function App() {
  return (
    <ShadowProvider container={document.body}>
      <QueryClientProvider client={queryClient}>
        {/* <ThemeProvider> */}
        {/* <DarkReaderIntegration /> */}
        <Toaster richColors={true} closeButton={true} />
        <IndexPage />
        {/* </ThemeProvider> */}
      </QueryClientProvider>
    </ShadowProvider>
  )
}

export default App
