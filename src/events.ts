export type ClubEvent = {
  title: string
  startsAt: string // ISO date and time with a timezone offset, for example 2026-10-15T18:00:00+02:00
  endsAt?: string
  location: string
  description: string
  url: string
}

// Add confirmed events here. Do not include attendee data or addresses withheld by the event host.
export const events: ClubEvent[] = [
  {
    title: 'Student E-club: first meeting',
    startsAt: '2026-10-20T18:30:00+02:00',
    endsAt: '2026-10-20T20:00:00+02:00',
    location: 'Address shared after registration',
    description: 'The club’s first meeting. Register on Luma to see the address and event details.',
    url: 'https://luma.com/30216joq',
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
