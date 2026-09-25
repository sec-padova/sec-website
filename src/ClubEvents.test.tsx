import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ClubEvents from './ClubEvents'
import type { ClubEvent } from './events'

const now = new Date('2026-09-25T12:00:00+02:00')

const later: ClubEvent = {
  title: 'Startup conversations',
  startsAt: '2026-10-20T18:00:00+02:00',
  location: 'Padova',
  description: 'Meet other curious builders.',
  url: 'https://example.org/startup-conversations',
}

describe('club events', () => {
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

    const cards = screen.getAllByRole('listitem')
    expect(within(cards[0]).getByRole('heading', { name: 'Ideas meetup' })).toBeInTheDocument()
    expect(within(cards[0]).getByText('10 Oct 2026')).toBeInTheDocument()
    expect(within(cards[0]).getByText('17:30 · Padova time')).toBeInTheDocument()
    expect(within(cards[0]).getByRole('link', { name: /event details/i })).toHaveAttribute('href', 'https://example.org/ideas')
    expect(within(cards[1]).getByRole('heading', { name: 'Startup conversations' })).toBeInTheDocument()
  })

  it('shows completed events in gray before upcoming events and excludes invalid entries', () => {
    render(<ClubEvents events={[
      later,
      { ...later, title: 'Expired', startsAt: '2026-09-01T18:00:00+02:00' },
      { ...later, title: 'Missing place', location: '' },
      { ...later, title: 'Unsafe link', url: 'javascript:alert(1)' },
    ]} now={now} />)

    const cards = screen.getAllByRole('listitem')
    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveClass('event-card-past')
    expect(within(cards[0]).getByRole('heading', { name: 'Expired' })).toBeInTheDocument()
    expect(within(cards[1]).getByRole('heading', { name: 'Startup conversations' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Startup conversations' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view past event/i })).toHaveAttribute('href', 'https://example.org/startup-conversations')
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
})
