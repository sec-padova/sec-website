import { useEffect, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function registrationRequest(client: SupabaseClient, body: Record<string, unknown>) {
  const { data, error } = await client.functions.invoke('organizer-register', { body })
  if (error) {
    let message = 'Could not connect. Please try again.'
    try { message = (await error.context.json()).error ?? message } catch { /* No response body on network errors. */ }
    throw new Error(message)
  }
  return data
}

export default function SharedRegistration({ client, token, signedIn, onComplete }: { client: SupabaseClient, token: string, signedIn: boolean, onComplete: () => void }) {
  const [valid, setValid] = useState(false)
  const [existing, setExisting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [checkAttempt, setCheckAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setError('')
    registrationRequest(client, { action: 'check', token }).then(() => { if (active) setValid(true) })
      .catch(error => { if (active) setError(error.message) })
    return () => { active = false }
  }, [client, token, checkAttempt])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email')).trim().toLowerCase()
    const password = String(form.get('password'))
    if (!signedIn && !existing && password !== form.get('confirm-password')) { setError('Your passwords do not match.'); return }
    setBusy(true)
    setError('')
    try {
      if (!signedIn) {
        if (!existing) await registrationRequest(client, { action: 'register', token, email, password })
        const { error } = await client.auth.signInWithPassword({ email, password })
        if (error) throw new Error('Could not sign in. Check your email and password, or ask the admin for a recovery link.')
      }
      // Also covers credentials created successfully before a failed admission attempt.
      if (signedIn || existing) await registrationRequest(client, { action: 'redeem', token })
      onComplete()
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not register. Please retry.') }
    finally { setBusy(false) }
  }
  return <section className="workspace-auth"><p className="eyebrow">Join the people behind the club</p><h1>{existing ? 'Sign in to join.' : 'Create your account.'}</h1>
    <p>This shared invitation lets you join the organizer workspace. You can choose working groups after joining.</p>
    {!valid && !error && <p role="status">Checking invitation…</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {!valid && error && <button className="workspace-button" onClick={() => setCheckAttempt(value => value + 1)}>Check link again</button>}
    {valid && <form className="workspace-form" onSubmit={submit}>
      {signedIn ? <p>Continue with your signed-in account.</p> : <>
        <label htmlFor="join-email">Email</label><input id="join-email" name="email" type="email" autoComplete="email" required maxLength={320} />
        <label htmlFor="join-password">{existing ? 'Password' : 'Password (at least 12 characters)'}</label><input id="join-password" name="password" type="password" autoComplete={existing ? 'current-password' : 'new-password'} required minLength={existing ? undefined : 12} />
        {!existing && <><label htmlFor="join-confirm">Confirm password</label><input id="join-confirm" name="confirm-password" type="password" autoComplete="new-password" required minLength={12} /><p>Your email address will not be verified. No confirmation email is sent.</p></>}
      </>}
      <p className="workspace-muted">Read the <a href="/organizers/privacy" target="_blank" rel="noopener noreferrer">organizer privacy notice</a> before continuing.</p>
      <button className="button button-dark" disabled={busy}>{busy ? 'Please wait…' : signedIn ? 'Join workspace' : existing ? 'Sign in and join' : 'Create account'}</button>
      {!signedIn && <button type="button" className="workspace-text-button" disabled={busy} onClick={() => { setExisting(!existing); setError('') }}>{existing ? 'Create a new account' : 'Already have an account? Sign in to join'}</button>}
    </form>}
    <p><a href="/organizers">Back to sign in</a></p>
  </section>
}
