import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ClubEvents from './ClubEvents'
import { events, type ClubEvent } from './events'

const now = new Date('2026-09-25T12:00:00+02:00')

const later: ClubEvent = {
  title: 'Startup conversations',
  startsAt: '2026-10-20T18:00:00+02:00',
  location: 'Padova',
  description: 'Meet other curious builders.',
  url: 'https://example.org/startup-conversations',
}

describe('club events', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows an honest empty state until an event is confirmed', () => {
    render(<ClubEvents events={[]} now={now} />)

    expect(screen.getByText('Our next gathering is taking shape.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /join the interest list/i })).toHaveAttribute('href', '#join')
    expect(screen.queryByRole('link', { name: /event details/i })).not.toBeInTheDocument()
  })

  it('shows future events in date order with a working external link', () => {
    render(<ClubEvents events={[later, {
      ...later,
      title: 'Ideas meetup',
      startsAt: '2026-10-10T17:30:00+02:00',
      url: 'https://example.org/ideas',
    }]} now={now} />)

    const feature = screen.getByRole('article', { name: 'Ideas meetup' })
    expect(within(feature).getByText('10 Oct 2026')).toBeInTheDocument()
    expect(within(feature).getByText('17:30 · Padova time')).toBeInTheDocument()
    expect(within(feature).getByRole('link', { name: /event details/i })).toHaveAttribute('href', 'https://example.org/ideas')
    expect(within(screen.getByRole('listitem')).getByRole('heading', { name: 'Startup conversations' })).toBeInTheDocument()
    expect(feature).toHaveClass('event-feature-text')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows upcoming events before completed events and excludes invalid entries', () => {
    render(<ClubEvents events={[
      later,
      { ...later, title: 'Expired', startsAt: '2026-09-01T18:00:00+02:00' },
      { ...later, title: 'Missing place', location: '' },
      { ...later, title: 'Unsafe link', url: 'javascript:alert(1)' },
      { ...later, title: 'Broken link', url: '' },
      { ...later, title: 'Invalid date', startsAt: 'invalid' },
      { ...later, title: 'Invalid end', endsAt: '2026-09-01T18:00:00+02:00' },
    ]} now={now} />)

    const feature = screen.getByRole('article', { name: 'Startup conversations' })
    const past = screen.getByRole('listitem')
    expect(past).toHaveClass('event-card-past')
    expect(within(past).getByRole('heading', { name: 'Expired' })).toBeInTheDocument()
    expect(feature.compareDocumentPosition(past) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    for (const title of ['Missing place', 'Unsafe link', 'Broken link', 'Invalid date', 'Invalid end']) {
      expect(screen.queryByRole('heading', { name: title })).not.toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: /view past event/i })).toHaveAttribute('href', later.url)
    expect(screen.getAllByRole('region', { name: /meet us at the next event/i })).toHaveLength(1)
  })

  it('shows the three most recent completed events, newest first', () => {
    const past = [1, 2, 3, 4].map((day) => ({
      ...later,
      title: `Past event ${day}`,
      startsAt: `2026-09-0${day}T18:00:00+02:00`,
    }))

    render(<ClubEvents events={past} now={now} />)

    const cards = screen.getAllByRole('listitem')
    expect(cards).toHaveLength(3)
    expect(within(cards[0]).getByRole('heading', { name: 'Past event 4' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Past event 1' })).not.toBeInTheDocument()
  })

  it('features the confirmed poster, local date, venue, and Luma registration', () => {
    render(<ClubEvents events={events} now={new Date('2026-10-20T12:00:00Z')} />)
    const feature = screen.getByRole('article', { name: 'Dead Startup Society' })
    expect(within(feature).getByText('28 Oct 2026')).toHaveAttribute('datetime', '2026-10-28T18:30:00+01:00')
    expect(within(feature).getByText('18:30 · Padova time')).toBeInTheDocument()
    expect(within(feature).getByText('Le Village by CA Triveneto')).toBeInTheDocument()
    expect(within(feature).getByRole('img', { name: /hooded skeleton/i })).toHaveAttribute('src', '/events/dead-startup-society.webp')
    const registration = within(feature).getByRole('link', { name: /register on luma/i })
    expect(registration).toHaveAttribute('href', 'https://luma.com/event/evt-dOCZWZIBbDHxJN2')
    expect(registration).toHaveAttribute('data-luma-event-id', 'evt-dOCZWZIBbDHxJN2')
    expect(registration).toHaveAttribute('data-luma-action', 'checkout')
  })

  it('enables registration when the URL is provided', () => {
    render(<ClubEvents events={[{ ...events[0], url: 'https://luma.com/confirmed-event', lumaEventId: undefined }]} now={now} />)
    const link = screen.getByRole('link', { name: /register on luma/i })
    expect(link).toHaveAttribute('href', 'https://luma.com/confirmed-event')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.queryByRole('button', { name: 'Registration coming soon' })).not.toBeInTheDocument()
  })

  it('archives an event without an end after its start, without requiring a link', () => {
    const announcement = { ...events[0], url: undefined, lumaEventId: undefined }
    const { rerender } = render(<ClubEvents events={[announcement]} now={new Date('2026-10-28T17:30:00Z')} />)
    expect(screen.getByRole('button', { name: 'Registration coming soon' })).toBeDisabled()
    expect(screen.getByRole('article', { name: 'Dead Startup Society' })).toBeInTheDocument()
    rerender(<ClubEvents events={[announcement]} now={new Date('2026-10-28T17:30:01Z')} />)
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dead Startup Society' })).toBeInTheDocument()
    expect(screen.getByText('Our next gathering is taking shape.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registration coming soon' })).not.toBeInTheDocument()
  })

  it('uses an ordinary link for a past Luma event', () => {
    render(<ClubEvents events={[events[0]]} now={new Date('2026-10-29T12:00:00Z')} />)
    const link = screen.getByRole('link', { name: /view past event/i })
    expect(link).toHaveAttribute('href', events[0].url)
    expect(link).not.toHaveAttribute('data-luma-action')
  })

  it('keeps an ongoing event featured until its end', () => {
    render(<ClubEvents events={[later]} now={new Date('2026-10-20T17:00:00Z')} />)
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    const ongoing = { ...later, endsAt: '2026-10-20T20:00:00+02:00' }
    const { container } = render(<ClubEvents events={[ongoing]} now={new Date('2026-10-20T17:00:00Z')} />)
    expect(within(container).getByRole('article', { name: later.title })).toBeInTheDocument()
  })

  it('leaves content visible when reduced motion is requested', () => {
    const observe = vi.fn()
    vi.stubGlobal('IntersectionObserver', class { observe = observe })
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { container } = render(<ClubEvents events={events} now={now} />)
    expect(observe).not.toHaveBeenCalled()
    expect(container.querySelector('.event-reveal-pending')).toBeNull()
  })

  it('reveals observed content once and disconnects on unmount', () => {
    let callback: IntersectionObserverCallback = () => {}
    const observe = vi.fn()
    const unobserve = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal('IntersectionObserver', class {
      constructor(onIntersect: IntersectionObserverCallback) { callback = onIntersect }
      observe = observe
      unobserve = unobserve
      disconnect = disconnect
    })
    const { unmount } = render(<ClubEvents events={events} now={now} />)
    const feature = screen.getByRole('article', { name: 'Dead Startup Society' })
    expect(feature).toHaveClass('event-reveal-pending')
    callback([{ isIntersecting: true, target: feature } as unknown as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(feature).not.toHaveClass('event-reveal-pending')
    expect(feature).toHaveClass('event-reveal-visible')
    expect(unobserve).toHaveBeenCalledWith(feature)
    unmount()
    expect(disconnect).toHaveBeenCalled()
  })
})
