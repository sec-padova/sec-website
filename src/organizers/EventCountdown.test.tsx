import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EventCountdown, { nextWorkspaceEvent } from './EventCountdown'
import { events } from '../events'

afterEach(() => vi.useRealTimers())

describe('workspace event countdown', () => {
  it('counts down to the actual public event in Padova time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-27T18:30:00+01:00'))
    render(<EventCountdown events={events} />)
    expect(screen.getByRole('heading', { name: 'Dead Startup Society' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveAccessibleName('1 days, 0 hours, 0 minutes until the event')
    expect(screen.getByText(/28 Oct 2026.*18:30.*Padova time/)).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(60000))
    expect(screen.getByRole('timer')).toHaveAccessibleName('0 days, 23 hours, 59 minutes until the event')
  })

  it('shows underway at the start, then advances after the end', () => {
    const meeting = { ...events[0], startsAt: '2026-11-01T18:00:00+01:00', endsAt: '2026-11-01T20:00:00+01:00' }
    vi.useFakeTimers()
    vi.setSystemTime(new Date(meeting.startsAt))
    render(<EventCountdown events={[meeting]} />)
    expect(screen.getByText('Event underway')).toBeInTheDocument()
    act(() => {
      vi.setSystemTime(new Date('2026-11-01T20:00:01+01:00'))
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByRole('heading', { name: 'The next event is taking shape.' })).toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })

  it('rejects invalid events and selects the next event in chronological order', () => {
    const next = { ...events[0], title: 'Next meeting', startsAt: '2026-11-01T18:00:00+01:00', endsAt: undefined }
    expect(nextWorkspaceEvent([next, { ...events[0], url: 'javascript:alert(1)' }, events[0]], Date.parse('2026-10-12'))?.title).toBe(events[0].title)
    expect(nextWorkspaceEvent([next, events[0]], Date.parse('2026-10-29'))?.title).toBe('Next meeting')
  })

  it('includes a confirmed public event before its registration link is available', () => {
    const event = { ...events[0], url: undefined }
    expect(nextWorkspaceEvent([event], Date.parse('2026-10-27'))).toBe(event)
  })
})
