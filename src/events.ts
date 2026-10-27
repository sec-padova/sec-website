export type ClubEvent = {
  title: string
  startsAt: string // ISO date and time with a timezone offset, for example 2026-10-15T18:00:00+02:00
  endsAt?: string
  location: string
  description: string
  url?: string
  lumaEventId?: string
  poster?: {
    src: string
    alt: string
    width: number
    height: number
  }
}

// Add confirmed events here. Do not include attendee data or addresses withheld by the event host.
export const events: ClubEvent[] = [
  {
    title: 'Dead Startup Society',
    startsAt: '2026-10-28T18:30:00+01:00',
    location: 'Le Village by CA Triveneto',
    description: 'Founders share their stories of failure. Unfiltered conversations, hard questions, and unexpected encounters.',
    url: 'https://luma.com/event/evt-dOCZWZIBbDHxJN2',
    lumaEventId: 'evt-dOCZWZIBbDHxJN2',
    poster: {
      src: '/events/dead-startup-society.webp',
      alt: 'Dead Startup Society poster: a hooded skeleton at a laptop, surrounded by startup plans and crumpled ideas.',
      width: 900,
      height: 1600,
    },
  },
  {
    title: 'Student Entrepreneurs Club — Launch Night',
    startsAt: '2026-09-22T18:30:00+02:00',
    endsAt: '2026-09-22T20:00:00+02:00',
    location: 'Le Village by CA Triveneto, Padova',
    description: 'Our launch night introduced the club and brought students together to meet and talk about entrepreneurship.',
    url: 'https://luma.com/pf6b3exb',
  },
]
