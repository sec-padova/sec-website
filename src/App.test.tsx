import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./lib/supabase', () => ({ supabase: null }))

describe('landing page', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-20T12:00:00+02:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('keeps the club invitation and approved collaborators visible', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: /ideas move when people meet/i })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /join the interest list/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /university of padova/i })).toHaveAttribute('href', 'https://www.unipd.it/en')
    expect(screen.getByRole('link', { name: /m31/i })).toHaveAttribute('href', 'https://www.m31.com/')
    expect(screen.getByRole('link', { name: /github/i })).toHaveAttribute('href', 'https://github.com/sec-padova')
    expect(screen.getByRole('link', { name: 'Events' })).toHaveAttribute('href', '#events')
    expect(screen.getByRole('heading', { name: /meet us at the next event/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dead Startup Society' })).toBeInTheDocument()
    expect(screen.getByText('18:30 · Padova time')).toBeInTheDocument()
    expect(screen.getByText('28 Oct 2026')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /register on luma/i })).toHaveAttribute('href', 'https://luma.com/event/evt-dOCZWZIBbDHxJN2')
    expect(screen.getAllByRole('link').some((link) => link.getAttribute('href') === 'https://luma.com/30216joq')).toBe(false)
    expect(screen.getByRole('heading', { name: 'Student Entrepreneurs Club — Launch Night' })).toBeInTheDocument()
    expect(screen.getAllByRole('link').some((link) => link.getAttribute('href') === 'https://luma.com/pf6b3exb')).toBe(true)
    expect(screen.queryAllByRole('link', { name: /launch event/i })).toHaveLength(0)
  })

  it('shows a private-by-default placeholder directory that can be expanded', () => {
    render(<App />)
    const toggle = screen.getByText('Explore the member directory')
    expect(toggle.closest('details')).toBeInTheDocument()
    expect(screen.getByText('Names coming soon')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Club member list' })).toBeInTheDocument()
  })

  it('takes join links to the interest section and explains setup state', () => {
    render(<App />)
    expect(screen.getAllByRole('link', { name: /join the (interest )?list/i }).every((link) => link.getAttribute('href') === '#join')).toBe(true)
    expect(screen.getByRole('status')).toHaveTextContent('The interest list is being set up')
  })

  it('serves the privacy notice directly with contact and retention information', () => {
    window.history.replaceState({}, '', '/privacy')
    try {
      render(<App />)
      expect(screen.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeInTheDocument()
      expect(screen.getAllByRole('link', { name: 'm.bustaffa@gmail.com' })[0]).toHaveAttribute('href', 'mailto:m.bustaffa@gmail.com')
      expect(screen.getByText(/maximum of 12 months from your original submission/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Back to the interest list' })).toHaveAttribute('href', '/#join')
    } finally {
      window.history.replaceState({}, '', '/')
    }
  })
})
