import {
  enable as enableDarkMode,
  disable as disableDarkMode,
} from 'darkreader'
import { useTheme } from 'next-themes'

export function DarkReaderIntegration() {
  const { resolvedTheme } = useTheme()
  useEffect(() => {
    console.log('theme', resolvedTheme)
    if (resolvedTheme === 'dark') {
      enableDarkMode({})
    } else {
      disableDarkMode()
    }
  }, [resolvedTheme])
  return <></>
}
