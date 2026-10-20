import { useEffect, useRef } from 'react'
import type { ClubEvent } from './events'

type Props = {
  events: ClubEvent[]
  now?: Date
}

function isPublishedEvent(event: ClubEvent) {
  const start = Date.parse(event.startsAt)
  const end = event.endsAt ? Date.parse(event.endsAt) : start

  if (event.url !== undefined) {
    try {
      if (new URL(event.url).protocol !== 'https:') return false
    } catch {
      return false
    }
  }

  return Boolean(event.title.trim() && event.description.trim() && event.location.trim())
    && Number.isFinite(start)
    && Number.isFinite(end)
    && end >= start
}

function endTime(event: ClubEvent) {
  return Date.parse(event.endsAt ?? event.startsAt)
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Rome',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Rome',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function EventDate({ event, past }: { event: ClubEvent, past?: boolean }) {
  return (
    <div className="event-date">
      <span className="event-date-label">{past ? 'Past event' : 'When'}</span>
      <time dateTime={event.startsAt}>{dateFormatter.format(new Date(event.startsAt))}</time>
      <span>
        {timeFormatter.format(new Date(event.startsAt))}
        {event.endsAt && `–${timeFormatter.format(new Date(event.endsAt))}`}
        {' · Padova time'}
      </span>
    </div>
  )
}

function EventAction({ event, past, featured }: { event: ClubEvent, past?: boolean, featured?: boolean }) {
  if (!event.url) {
    return past ? null : <button className="event-link event-link-pending" disabled>Registration coming soon</button>
  }

  const isLuma = new URL(event.url).hostname === 'luma.com'

  return (
    <a className="event-link" href={event.url} target="_blank" rel="noopener noreferrer">
      {past ? 'View past event' : featured && isLuma ? 'Register on Luma' : 'Event details'} <span aria-hidden="true">↗︎</span>
    </a>
  )
}

function EventCard({ event, past }: { event: ClubEvent, past?: boolean }) {
  return (
    <li className={`event-card${past ? ' event-card-past' : ''}`} data-event-reveal>
      <EventDate event={event} past={past} />
      <div className="event-details">
        <p className="event-location">{event.location}</p>
        <h3>{event.title}</h3>
        <p>{event.description}</p>
      </div>
      <EventAction event={event} past={past} />
    </li>
  )
}

function FeaturedEvent({ event }: { event: ClubEvent }) {
  return (
    <article className={`event-feature${event.poster ? '' : ' event-feature-text'}`} aria-labelledby="featured-event-title" data-event-reveal>
      {event.poster && (
        <div className="event-poster">
          <img src={event.poster.src} alt={event.poster.alt} width={event.poster.width} height={event.poster.height} loading="lazy" decoding="async" />
        </div>
      )}
      <div className="event-feature-copy">
        <p className="event-feature-label"><span aria-hidden="true">✳︎</span> Next up / In Padova</p>
        <h3 id="featured-event-title">{event.title}</h3>
        <p className="event-feature-description">{event.description}</p>
        <div className="event-feature-meta">
          <EventDate event={event} />
          <div className="event-venue">
            <span className="event-date-label">Where</span>
            <p>{event.location}</p>
          </div>
        </div>
        <div className="event-feature-action"><EventAction event={event} featured /></div>
      </div>
    </article>
  )
}

export default function ClubEvents({ events, now = new Date() }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const published = events.filter(isPublishedEvent)
  const upcoming = published
    .filter((event) => endTime(event) >= now.getTime())
    .sort((first, second) => Date.parse(first.startsAt) - Date.parse(second.startsAt))
  const recentPast = published
    .filter((event) => endTime(event) < now.getTime())
    .sort((first, second) => Date.parse(second.startsAt) - Date.parse(first.startsAt))
    .slice(0, 3)
  const [featured, ...remaining] = upcoming

  useEffect(() => {
    if (!sectionRef.current || !('IntersectionObserver' in window)
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const elements = sectionRef.current.querySelectorAll<HTMLElement>('[data-event-reveal]')
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.remove('event-reveal-pending')
        entry.target.classList.add('event-reveal-visible')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.08 })

    elements.forEach((element) => {
      element.classList.add('event-reveal-pending')
      observer.observe(element)
    })

    return () => {
      observer.disconnect()
      elements.forEach((element) => element.classList.remove('event-reveal-pending', 'event-reveal-visible'))
    }
  }, [events, featured?.startsAt])

  return (
    <section ref={sectionRef} className="events section-pad" id="events" aria-labelledby="events-title">
      <div className="section-wrap">
        <div className="section-heading-row" data-event-reveal>
          <div>
            <p className="eyebrow">03 / On the calendar</p>
            <h2 id="events-title">Meet us at{' '}<br /><em>the next event.</em></h2>
          </div>
          <p>Ideas move faster when we get together. See what’s coming up in Padova.</p>
        </div>

        {featured ? <FeaturedEvent event={featured} /> : (
          <div className="events-empty" data-event-reveal>
            <span className="events-empty-mark" aria-hidden="true">✳︎</span>
            <div>
              <p className="event-location">More to come</p>
              <h3>Our next gathering is taking shape.</h3>
              <p>We’ll share the date, place, and event link here when they’re confirmed.</p>
            </div>
            <a className="event-link" href="#join">Join the interest list <span aria-hidden="true">↘︎</span></a>
          </div>
        )}
        {remaining.length > 0 && (
          <div className="event-group">
            <h3 className="event-group-title" id="more-events-title">More on the calendar</h3>
            <ul className="event-list" aria-labelledby="more-events-title">
              {remaining.map((event) => <EventCard event={event} key={`${event.startsAt}-${event.title}`} />)}
            </ul>
          </div>
        )}
        {recentPast.length > 0 && (
          <div className="event-group">
            <h3 className="event-group-title" id="past-events-title">Previously, together</h3>
            <ul className="event-list" aria-labelledby="past-events-title">
              {recentPast.map((event) => <EventCard event={event} past key={`${event.startsAt}-${event.title}`} />)}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
