import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import InterestForm from './InterestForm'

function mockClient() {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
  return { client: { rpc } as unknown as SupabaseClient, rpc }
}

describe('club interest list', () => {
  it('explains when the interest list is unavailable', () => {
    render(<InterestForm client={null} />)
    expect(screen.getByRole('status')).toHaveTextContent('The interest list is being set up')
    expect(screen.queryByRole('textbox', { name: 'Email' })).not.toBeInTheDocument()
  })

  it('requires only an email, with no password or account creation', async () => {
    const { client, rpc } = mockClient()
    render(<InterestForm client={client} />)
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeRequired()
    expect(screen.getByRole('textbox', { name: 'Phone number (optional)' })).not.toBeRequired()
    expect(screen.getByRole('combobox', { name: 'Country code' })).not.toBeRequired()
    expect(screen.getByRole('combobox', { name: 'Country code' })).toHaveValue('IT')
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/first name|last name|department|school|student/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/create an account/i)).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: ' Ada@Example.com ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join the interest list' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('join_interest_list', { p_email: 'ada@example.com', p_phone_number: null }))
    expect(screen.getByRole('status')).toHaveTextContent(/invitation to join the club later/i)
    expect(screen.getByRole('status')).not.toHaveTextContent(/account/i)
  })

  it.each([
    ['IT', '02 3661 8300', '+390236618300'],
    ['GB', '020 7946 0958', '+442079460958'],
    ['US', '(213) 373-4253', '+12133734253'],
    ['CA', '(416) 555-0123', '+14165550123'],
    ['FR', '06 12 34 56 78', '+33612345678'],
    ['IT', '+44 20 7946 0958', '+442079460958'],
    ['GB', '0044 20 7946 0958', '+442079460958'],
    ['GB', '   ', null],
  ])('submits a phone number for %s as %s', async (country, phone, normalized) => {
    const { client, rpc } = mockClient()
    render(<InterestForm client={client} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'ada@example.com' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Country code' }), { target: { value: country } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Phone number (optional)' }), { target: { value: phone } })
    fireEvent.click(screen.getByRole('button', { name: 'Join the interest list' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('join_interest_list', { p_email: 'ada@example.com', p_phone_number: normalized }))
    expect(screen.getByRole('status')).toHaveTextContent('Thanks for your interest')
  })

  it.each(['123', '+999 123456789', 'Call me at +44 20 7946 0958', '+44 20 7946 0958 ext. 123', '+442079460958123456789'])('rejects malformed phone input: %s', phone => {
    const { client, rpc } = mockClient()
    render(<InterestForm client={client} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'ada@example.com' } })
    const phoneInput = screen.getByRole('textbox', { name: 'Phone number (optional)' })
    fireEvent.change(phoneInput, { target: { value: phone } })
    fireEvent.click(screen.getByRole('button', { name: 'Join the interest list' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a complete phone number')
    expect(phoneInput).toHaveAttribute('aria-invalid', 'true')
    expect(phoneInput).toHaveFocus()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('allows email-only submission after clearing an invalid optional number', async () => {
    const { client, rpc } = mockClient()
    render(<InterestForm client={client} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'ada@example.com' } })
    const phoneInput = screen.getByRole('textbox', { name: 'Phone number (optional)' })
    fireEvent.change(phoneInput, { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join the interest list' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.change(phoneInput, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join the interest list' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('join_interest_list', { p_email: 'ada@example.com', p_phone_number: null }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('rejects an invalid email before calling the database', () => {
    const { client, rpc } = mockClient()
    render(<InterestForm client={client} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join the interest list' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('does not expose database errors to the visitor', async () => {
    const { client, rpc } = mockClient()
    rpc.mockResolvedValueOnce({ data: null, error: new Error('private table: internal failure') })
    render(<InterestForm client={client} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'ada@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join the interest list' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not add your email')
    expect(screen.queryByText(/private table/)).not.toBeInTheDocument()
  })
})
