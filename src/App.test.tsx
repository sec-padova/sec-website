import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./lib/supabase', () => ({ supabase: null }))

describe('landing page', () => {
  it('keeps the club invitation and approved collaborators visible', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: /ideas move when people meet/i })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /join the interest list/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /university of padova/i })).toHaveAttribute('href', 'https://www.unipd.it/en')
    expect(screen.getByRole('link', { name: /m31/i })).toHaveAttribute('href', 'https://www.m31.com/')
    expect(screen.getByRole('link', { name: /github/i })).toHaveAttribute('href', 'https://github.com/sec-padova')
    expect(screen.getByRole('link', { name: 'Events' })).toHaveAttribute('href', '#events')
    expect(screen.getByRole('heading', { name: /meet us at the next event/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Student E-club: first meeting' })).toBeInTheDocument()
    expect(screen.getAllByText('18:30–20:00 · Padova time')).toHaveLength(2)
    expect(screen.getAllByRole('link').some((link) => link.getAttribute('href') === 'https://luma.com/30216joq')).toBe(true)
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
})
