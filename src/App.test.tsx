import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('landing page', () => {
  it('keeps the club invitation and approved collaborators visible', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: /ideas move when people meet/i })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /join the club/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /university of padova/i })).toHaveAttribute('href', 'https://www.unipd.it/en')
    expect(screen.getByRole('link', { name: /m31/i })).toHaveAttribute('href', 'https://www.m31.com/')
  })

  it('shows a private-by-default placeholder directory that can be expanded', () => {
    render(<App />)
    const toggle = screen.getByText('Explore the member directory')
    expect(toggle.closest('details')).toBeInTheDocument()
    expect(screen.getByText('Names coming soon')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Club member list' })).toBeInTheDocument()
  })
})
