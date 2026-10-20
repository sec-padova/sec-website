import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LumaCheckoutLink from './LumaCheckoutLink'

const eventId = 'evt-dOCZWZIBbDHxJN2'
const href = `https://luma.com/event/${eventId}`

afterEach(() => {
  document.getElementById('luma-checkout')?.remove()
  vi.unstubAllGlobals()
})

describe('Luma checkout link', () => {
  it('keeps a usable event link before the embed loads and after a script failure', () => {
    render(<LumaCheckoutLink eventId={eventId} href={href} />)
    const link = screen.getByRole('link', { name: /register on luma/i })
    expect(link).toHaveAttribute('href', href)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveAttribute('data-luma-action', 'checkout')
    expect(link).toHaveAttribute('data-luma-event-id', eventId)
    expect(link).toHaveClass('event-link')
    // The provider's default button class would override the site's styling.
    expect(link).not.toHaveClass('luma-checkout--button')
    const script = document.getElementById('luma-checkout')!
    expect(script).toHaveAttribute('src', 'https://embed.lu.ma/checkout-button.js')
    fireEvent.error(script)
    expect(document.getElementById('luma-checkout')).toBeNull()
    expect(link).toHaveAttribute('href', href)
  })

  it('loads one shared script and initializes the mounted buttons when ready', () => {
    render(<StrictMode>
      <LumaCheckoutLink eventId={eventId} href={href} />
      <LumaCheckoutLink eventId="evt-another" href="https://luma.com/another" />
    </StrictMode>)
    expect(document.querySelectorAll('#luma-checkout')).toHaveLength(1)
    const initCheckout = vi.fn()
    vi.stubGlobal('luma', { initCheckout })
    fireEvent.load(document.getElementById('luma-checkout')!)
    expect(initCheckout).toHaveBeenCalledTimes(2)
  })

  it('reinitializes after a remount or event change without duplicating the script', () => {
    const initCheckout = vi.fn()
    vi.stubGlobal('luma', { initCheckout })
    const { rerender, unmount } = render(<LumaCheckoutLink eventId={eventId} href={href} />)
    expect(initCheckout).toHaveBeenCalledTimes(1)
    rerender(<LumaCheckoutLink eventId="evt-next" href="https://luma.com/next" />)
    expect(initCheckout).toHaveBeenCalledTimes(2)
    unmount()
    // Unmounted components no longer respond to script load events.
    fireEvent.load(document.getElementById('luma-checkout')!)
    expect(initCheckout).toHaveBeenCalledTimes(2)
    render(<LumaCheckoutLink eventId={eventId} href={href} />)
    expect(initCheckout).toHaveBeenCalledTimes(3)
    expect(document.querySelectorAll('#luma-checkout')).toHaveLength(1)
  })
})
