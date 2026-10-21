import { StrictMode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import useScrollReveal from './useScrollReveal'

function Page() {
  const ref = useScrollReveal()
  return <main ref={ref}>
    <h1>Always visible</h1>
    <section data-reveal aria-label="Invitation"><a href="#join">Join</a></section>
    <section data-reveal aria-label="Details">Details</section>
  </main>
}

function mockObserver() {
  const instances: {
    callback: IntersectionObserverCallback
    observe: ReturnType<typeof vi.fn>
    unobserve: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
  }[] = []
  vi.stubGlobal('IntersectionObserver', class {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
    constructor(public callback: IntersectionObserverCallback) { instances.push(this) }
  })
  return instances
}

function intersect(instance: ReturnType<typeof mockObserver>[number], target: Element, isIntersecting = true) {
  instance.callback([{ target, isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver)
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('scroll reveal', () => {
  it('keeps content visible when observation is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const { container } = render(<Page />)
    expect(container.querySelector('.reveal-pending')).toBeNull()
    expect(screen.getByRole('link', { name: 'Join' })).toBeVisible()
  })

  it('respects reduced motion from the first render', () => {
    const instances = mockObserver()
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { container } = render(<Page />)
    expect(instances).toHaveLength(0)
    expect(container.querySelector('.reveal-pending')).toBeNull()
  })

  it('reveals each target once and cleans up on unmount', () => {
    const instances = mockObserver()
    const { unmount } = render(<Page />)
    const observer = instances[0]
    const invitation = screen.getByRole('region', { name: 'Invitation' })
    expect(observer.observe).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('heading')).not.toHaveClass('reveal-pending')
    expect(invitation).toHaveClass('reveal-pending')
    intersect(observer, invitation, false)
    expect(invitation).toHaveClass('reveal-pending')
    intersect(observer, invitation)
    expect(invitation).not.toHaveClass('reveal-pending')
    expect(invitation).toHaveClass('reveal-visible')
    intersect(observer, invitation)
    expect(observer.unobserve).toHaveBeenCalledTimes(1)
    unmount()
    expect(observer.disconnect).toHaveBeenCalledOnce()
    expect(invitation).not.toHaveClass('reveal-visible')
  })

  it('immediately reveals keyboard-focused content without replaying its entrance', () => {
    const instances = mockObserver()
    render(<Page />)
    const invitation = screen.getByRole('region', { name: 'Invitation' })
    screen.getByRole('link', { name: 'Join' }).focus()
    expect(invitation).not.toHaveClass('reveal-pending', 'reveal-visible')
    intersect(instances[0], invitation)
    expect(invitation).not.toHaveClass('reveal-visible')
    expect(instances[0].unobserve).toHaveBeenCalledWith(invitation)
  })

  it('stops active and pending motion when the preference changes', () => {
    const instances = mockObserver()
    const preference = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
    vi.stubGlobal('matchMedia', () => preference)
    const { container, unmount } = render(<Page />)
    intersect(instances[0], screen.getByRole('region', { name: 'Invitation' }))
    expect(container.querySelector('.reveal-visible')).not.toBeNull()
    preference.matches = true
    const onChange = preference.addEventListener.mock.calls[0][1]
    onChange()
    expect(container.querySelector('.reveal-pending, .reveal-visible')).toBeNull()
    expect(instances[0].disconnect).toHaveBeenCalledOnce()
    // Turning motion back on must not hide already visible content again.
    preference.matches = false
    onChange()
    expect(container.querySelector('.reveal-pending, .reveal-visible')).toBeNull()
    unmount()
    expect(preference.removeEventListener).toHaveBeenCalledWith('change', onChange)
  })

  it('keeps a single active observer through Strict Mode setup and cleanup', () => {
    const instances = mockObserver()
    render(<StrictMode><Page /></StrictMode>)
    expect(instances).toHaveLength(2)
    expect(instances[0].disconnect).toHaveBeenCalledOnce()
    expect(instances[1].disconnect).not.toHaveBeenCalled()
    expect(instances[1].observe).toHaveBeenCalledTimes(2)
  })
})
