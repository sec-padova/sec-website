import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import SharedRegistration from './SharedRegistration'
const token = 'a'.repeat(64)
function fixture(signedIn = false) {
  const invoke = vi.fn().mockResolvedValue({ data: { valid: true }, error: null })
  const signInWithPassword = vi.fn().mockResolvedValue({ error: null })
  const onComplete = vi.fn()
  const client = { functions: { invoke }, auth: { signInWithPassword } } as unknown as SupabaseClient
  render(<SharedRegistration client={client} token={token} signedIn={signedIn} onComplete={onComplete} />)
  return { invoke, signInWithPassword, onComplete }
}
describe('shared registration form', () => {
  it('creates credentials once, signs in, and advances to onboarding', async () => {
    const { invoke, signInWithPassword, onComplete } = fixture()
    const submit = await screen.findByRole('button', { name: 'Create account' })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.org' } })
    fireEvent.change(screen.getByLabelText('Password (at least 12 characters)'), { target: { value: 'a-long-password' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'a-long-password' } })
    fireEvent.click(submit)
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce())
    expect(invoke).toHaveBeenCalledWith('organizer-register', { body: { action: 'register', token, email: 'ada@example.org', password: 'a-long-password' } })
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'ada@example.org', password: 'a-long-password' })
  })
  it('uses authenticated redemption rather than creating another account', async () => {
    const { invoke, signInWithPassword, onComplete } = fixture(true)
    fireEvent.click(await screen.findByRole('button', { name: 'Join workspace' }))
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce())
    expect(invoke).toHaveBeenCalledWith('organizer-register', { body: { action: 'redeem', token } })
    expect(signInWithPassword).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  })
  it('supports existing-account sign-in without resetting its password', async () => {
    const { invoke, onComplete } = fixture()
    fireEvent.click(await screen.findByRole('button', { name: 'Already have an account? Sign in to join' }))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.org' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'existing-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in and join' }))
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce())
    expect(invoke.mock.calls.map(call => call[1].body.action)).toEqual(['check', 'redeem'])
  })
})
