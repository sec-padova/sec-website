import { useEffect } from 'react'

declare global {
  interface Window {
    luma?: { initCheckout: () => void }
  }
}

type Props = {
  eventId: string
  href: string
}

export default function LumaCheckoutLink({ eventId, href }: Props) {
  useEffect(() => {
    const initialize = () => window.luma?.initCheckout()
    let script = document.getElementById('luma-checkout') as HTMLScriptElement | null

    if (!script) {
      script = document.createElement('script')
      script.id = 'luma-checkout'
      script.src = 'https://embed.lu.ma/checkout-button.js'
      script.async = true
      document.body.appendChild(script)
    }

    // The provider binds existing anchors, so re-initialize after React mounts.
    // Keep the shared script on unmount; Luma retains its global initializer.
    const handleError = () => script.remove()
    script.addEventListener('load', initialize)
    script.addEventListener('error', handleError)
    initialize()

    return () => {
      script.removeEventListener('load', initialize)
      script.removeEventListener('error', handleError)
    }
  }, [eventId, href])

  return (
    <a className="event-link" href={href} target="_blank" rel="noopener noreferrer"
      data-luma-action="checkout" data-luma-event-id={eventId}>
      Register on Luma <span aria-hidden="true">↗︎</span>
    </a>
  )
}
