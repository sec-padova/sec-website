import { useEffect, useRef } from 'react'

// Content starts visible. Only an active observer opts it into entrance motion.
export default function useScrollReveal() {
  const rootRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof window.IntersectionObserver !== 'function') return

    const motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (motionPreference?.matches) return

    const elements = root.querySelectorAll<HTMLElement>('[data-reveal]')
    const pending = new Set(elements)
    const reveal = (element: HTMLElement, immediate = false) => {
      if (!pending.delete(element)) return
      element.classList.remove('reveal-pending')
      if (!immediate) element.classList.add('reveal-visible')
      observer.unobserve(element)
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) reveal(entry.target as HTMLElement, motionPreference?.matches)
      })
    }, { threshold: 0.08 })

    const showFocusedContent = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return
      const element = event.target.closest<HTMLElement>('[data-reveal]')
      if (!element) return
      reveal(element, true)
      // Keyboard navigation must not wait for an entrance already in progress.
      element.classList.remove('reveal-visible')
    }
    const stopMotion = () => {
      if (!motionPreference?.matches) return
      observer.disconnect()
      pending.clear()
      elements.forEach((element) => element.classList.remove('reveal-pending', 'reveal-visible'))
    }

    elements.forEach((element) => {
      if (element.contains(document.activeElement)) {
        pending.delete(element)
        return
      }
      element.classList.add('reveal-pending')
      observer.observe(element)
    })
    root.addEventListener('focusin', showFocusedContent)
    motionPreference?.addEventListener('change', stopMotion)

    return () => {
      observer.disconnect()
      root.removeEventListener('focusin', showFocusedContent)
      motionPreference?.removeEventListener('change', stopMotion)
      elements.forEach((element) => element.classList.remove('reveal-pending', 'reveal-visible'))
    }
  }, [])

  return rootRef
}
