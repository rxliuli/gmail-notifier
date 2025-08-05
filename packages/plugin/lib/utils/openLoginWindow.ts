export function openLoginWindow(url: string) {
  // Check if it's a mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

  if (isMobile) {
    // Mobile device: open in new tab
    window.open(url, '_blank')
  } else {
    // Desktop device: open popup
    const width = 500 // Window width
    const height = 600 // Window height

    // Calculate window position to center it
    const left = (window.innerWidth - width) / 2 + window.screenX
    const top = (window.innerHeight - height) / 2 + window.screenY

    // Configure window parameters
    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      'resizable=yes',
      'scrollbars=yes',
      'status=yes',
    ].join(',')

    // Open popup
    window.open(url, 'LoginWindow', features)
  }
}
