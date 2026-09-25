import type { ClubEvent } from './events'

type Props = {
  events: ClubEvent[]
  now?: Date
}

function isPublishedEvent(event: ClubEvent) {
  const start = Date.parse(event.startsAt)
  const end = event.endsAt ? Date.parse(event.endsAt) : start
  let url: URL

  try {
    url = new URL(event.url)
  } catch {
    return false
  }

  return Boolean(event.title.trim() && event.description.trim() && event.location.trim())
    && Number.isFinite(start)
    && Number.isFinite(end)
    && end >= start
    && url.protocol === 'https:'
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

function EventCard({ event, past }: { event: ClubEvent, past?: boolean }) {
  return (
    <li className={`event-card${past ? ' event-card-past' : ''}`}>
      <div className="event-date">
        <span className="event-date-label">{past ? 'Past event' : 'When'}</span>
        <time dateTime={event.startsAt}>{dateFormatter.format(new Date(event.startsAt))}</time>
        <span>
          {timeFormatter.format(new Date(event.startsAt))}
          {event.endsAt && `–${timeFormatter.format(new Date(event.endsAt))}`}
          {' · Padova time'}
        </span>
      </div>
      <div className="event-details">
        <p className="event-location">{event.location}</p>
        <h3>{event.title}</h3>
        <p>{event.description}</p>
      </div>
      <a className="event-link" href={event.url} target="_blank" rel="noopener noreferrer">
        {past ? 'View past event' : 'Event details'} <span aria-hidden="true">↗︎</span>
      </a>
    </li>
  )
}

export default function ClubEvents({ events, now = new Date() }: Props) {
  const published = events.filter(isPublishedEvent)
  const upcoming = published
    .filter((event) => endTime(event) >= now.getTime())
    .sort((first, second) => Date.parse(first.startsAt) - Date.parse(second.startsAt))
  const recentPast = published
    .filter((event) => endTime(event) < now.getTime())
    .sort((first, second) => Date.parse(second.startsAt) - Date.parse(first.startsAt))
    .slice(0, 3)

  return (
    <section className="events section-pad" id="events" aria-labelledby="events-title">
      <div className="section-wrap">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">03 / On the calendar</p>
            <h2 id="events-title">Meet us at{' '}<br /><em>the next event.</em></h2>
          </div>
          <p>Ideas move faster when we get together. See what’s coming up in Padova.</p>
        </div>

        {(recentPast.length > 0 || upcoming.length > 0) && (
          <ul className="event-list">
            {recentPast.map((event) => <EventCard event={event} past key={`${event.startsAt}-${event.title}`} />)}
            {upcoming.map((event) => <EventCard event={event} key={`${event.startsAt}-${event.title}`} />)}
          </ul>
        )}
        {upcoming.length === 0 && (
          <div className="events-empty">
            <span className="events-empty-mark" aria-hidden="true">✳︎</span>
            <div>
              <p className="event-location">More to come</p>
              <h3>Our next gathering is taking shape.</h3>
              <p>We’ll share the date, place, and event link here when they’re confirmed.</p>
            </div>
            <a className="event-link" href="#join">Join the interest list <span aria-hidden="true">↘︎</span></a>
          </div>
        )}
      </div>
    </section>
  )
}
