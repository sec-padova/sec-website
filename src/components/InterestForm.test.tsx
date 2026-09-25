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

  it('collects only an email, with no password or account creation', async () => {
    const { client, rpc } = mockClient()
    render(<InterestForm client={client} />)
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/first name|last name|department|school|student/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/create an account/i)).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: ' Ada@Example.com ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join the interest list' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('join_interest_list', { p_email: 'ada@example.com' }))
    expect(screen.getByRole('status')).toHaveTextContent(/invitation to join the club later/i)
    expect(screen.getByRole('status')).not.toHaveTextContent(/account/i)
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
