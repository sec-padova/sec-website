import { useEffect, useState } from 'react'
import type { ClubEvent } from '../events'
import { workspaceDate } from './api'

export function nextWorkspaceEvent(events: ClubEvent[], now: number) {
  return events.filter(event => {
    const start = Date.parse(event.startsAt)
    const end = Date.parse(event.endsAt ?? event.startsAt)
    try {
      return event.title.trim() && event.location.trim() && event.description.trim()
        && Number.isFinite(start) && Number.isFinite(end) && end >= start && end >= now
        && new URL(event.url).protocol === 'https:'
    } catch { return false }
  }).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0]
}

export default function EventCountdown({ events }: { events: ClubEvent[] }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    const update = () => setNow(Date.now())
    window.addEventListener('focus', update)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', update)
    }
  }, [])
  const event = nextWorkspaceEvent(events, now)
  const minutes = event ? Math.max(0, Math.ceil((Date.parse(event.startsAt) - now) / 60000)) : 0
  return (
    <section className="workspace-event" aria-labelledby="workspace-event-title">
      <div>
        <p className="eyebrow">Our next gathering</p>
        <h2 id="workspace-event-title">{event?.title ?? 'The next event is taking shape.'}</h2>
        {event ? <p><time dateTime={event.startsAt}>{workspaceDate(event.startsAt)} · Padova time</time></p> : <p>Confirmed events will appear here as they’re announced.</p>}
      </div>
      {event && (Date.parse(event.startsAt) <= now ? <strong className="event-underway">Event underway</strong> : (
        <div className="countdown" role="timer" aria-label={`${Math.floor(minutes / 1440)} days, ${Math.floor(minutes % 1440 / 60)} hours, ${minutes % 60} minutes until the event`}>
          {[[Math.floor(minutes / 1440), 'days'], [Math.floor(minutes % 1440 / 60), 'hours'], [minutes % 60, 'minutes']].map(([value, label]) => (
            <div key={label}><strong>{String(value).padStart(2, '0')}</strong><span>{label}</span></div>
          ))}
        </div>
      ))}
    </section>
  )
}
