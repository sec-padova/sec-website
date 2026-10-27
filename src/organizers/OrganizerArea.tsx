import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { privacyController } from '../privacy'
import { workspaceRpc, type OrganizerContext } from './api'
import OrganizerWorkspace from './OrganizerWorkspace'
import OrganizerPrivacy from './OrganizerPrivacy'

function OrganizerShell({ children }: { children: ReactNode }) {
  return <main className="organizer-page section-wrap">
    <a className="skip-link" href="#organizer-content">Skip to content</a>
    <header className="workspace-header"><a className="brand" href="/">Student Entrepreneurs Club</a><a href="/">Club website ↗</a></header>
    <div id="organizer-content">{children}</div>
    <footer className="workspace-footer"><span>SEC Padova · Working together</span><a href="/organizers/privacy">Organizer privacy notice</a></footer>
  </main>
}

function Login({ client }: { client: SupabaseClient }) {
  const [recovery, setRecovery] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  function toggleRecovery() {
    setRecovery(!recovery)
    setError('')
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      const email = String(data.get('email')).trim().toLowerCase()
      const result = await client.auth.signInWithPassword({ email, password: String(data.get('password')) })
      if (result.error) setError('Could not sign in. Check your email and password.')
    } catch { setError('Could not connect. Please try again.') }
    finally { setBusy(false) }
  }
  if (recovery) return <section className="workspace-auth interest-wrap workspace-login" aria-labelledby="organizer-recovery-title">
    <p className="eyebrow">Account help</p><h1 id="organizer-recovery-title">Reset your password.</h1>
    <p>Ask a club admin for a private password setup link. The club sends these links manually to your account email address.</p>
    <button type="button" className="workspace-text-button" onClick={toggleRecovery}>Back to sign in</button>
  </section>
  return <section className="workspace-auth interest-wrap workspace-login" aria-labelledby="organizer-login-title">
    <div className="interest-card-top">
      <p className="eyebrow">The people behind the club</p>
      <span className="interest-card-mark" aria-hidden="true">↗</span>
    </div>
    <h1 id="organizer-login-title">Welcome back.</h1>
    <p className="interest-card-description workspace-login-description">An invitation-only space to see what our working groups are doing.</p>
    <form onSubmit={submit} className="workspace-form workspace-login-form">
      <div className="form-field">
        <div className="form-label-row"><label htmlFor="organizer-email">Email</label><span className="field-required">Required</span></div>
        <div className="form-input-wrap">
          <svg className="form-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>
          <input id="organizer-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={320} />
        </div>
      </div>
      <div className="form-field">
        <div className="form-label-row"><label htmlFor="organizer-password">Password</label><button type="button" className="workspace-text-button workspace-forgot-password" onClick={toggleRecovery}>Forgot your password?</button></div>
        <div className="form-input-wrap">
          <svg className="form-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><circle cx="12" cy="15.5" r="1" /></svg>
          <input id="organizer-password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required />
        </div>
      </div>
      {error && <p role="alert" className="form-error">{error}</p>}
      <button className="button button-dark workspace-sign-in" disabled={busy}>{busy ? 'Please wait…' : 'Sign in'}</button>
    </form>
    <div className="workspace-login-footer"><p>New to the workspace? <a href="/organizers/register">Create your account</a></p></div>
  </section>
}

function RegistrationEntry() {
  return <section className="workspace-auth" aria-labelledby="organizer-registration-title">
    <p className="eyebrow">Join the people behind the club</p>
    <h1 id="organizer-registration-title">Create your account.</h1>
    <p>A club admin chooses who can join this invitation-only workspace. Ask an admin to invite your email address, then open the Create your account link in that email.</p>
    <p>Your invitation lets you choose a password, add your name, and join working groups. No separate approval is needed after you register.</p>
    <a className="button button-dark" href="/organizers">Back to sign in</a>
  </section>
}

function AccountSetup({ client, onboarding, onComplete }: { client: SupabaseClient, onboarding: boolean, onComplete: () => Promise<void> }) {
  const [groups, setGroups] = useState<{ id: string, name: string, mission: string }[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [choicesError, setChoicesError] = useState(false)
  const [choicesLoading, setChoicesLoading] = useState(onboarding)
  const loadChoices = useCallback(async () => {
    setChoicesLoading(true)
    setChoicesError(false)
    try { setGroups(await workspaceRpc(client, 'organizer_group_choices')) }
    catch { setChoicesError(true) }
    finally { setChoicesLoading(false) }
  }, [client])
  useEffect(() => { if (onboarding) void loadChoices() }, [onboarding, loadChoices])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError('')
    const password = String(form.get('password'))
    if (password !== form.get('confirm-password')) {
      setError('Your passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const { error: passwordError } = await client.auth.updateUser({ password })
      if (passwordError) {
        setError('Could not set your password. Use at least 12 characters and try again.')
        return
      }
      if (onboarding) await workspaceRpc(client, 'complete_organizer_onboarding', {
        p_first_name: String(form.get('first-name')).trim(), p_last_name: String(form.get('last-name')).trim(), p_group_ids: selected,
      })
      await onComplete()
    } catch { setError('Could not finish setting up your account. Your details are still here. Please try again.') }
    finally { setBusy(false) }
  }
  return <section className="workspace-auth" aria-labelledby="organizer-setup-title">
    <p className="eyebrow">Let’s get you settled</p><h1 id="organizer-setup-title">{onboarding ? 'Create your account.' : 'Choose a new password.'}</h1>
    {onboarding && <p>Your invitation gives you access to the workspace. Choose a password and add your name so the team can see who’s working on what. You can join groups now or later.</p>}
    <form onSubmit={submit} className="workspace-form">
      {onboarding && <>
        <label htmlFor="organizer-first-name">First name</label><input id="organizer-first-name" name="first-name" autoComplete="given-name" required maxLength={100} pattern=".*\S.*" />
        <label htmlFor="organizer-last-name">Last name</label><input id="organizer-last-name" name="last-name" autoComplete="family-name" required maxLength={100} pattern=".*\S.*" />
      </>}
      <label htmlFor="setup-password">Password (at least 12 characters)</label><input id="setup-password" name="password" type="password" autoComplete="new-password" required minLength={12} />
      <label htmlFor="setup-confirm-password">Confirm password</label><input id="setup-confirm-password" name="confirm-password" type="password" autoComplete="new-password" required minLength={12} />
      {onboarding && <fieldset className="workspace-group-choices"><legend>Your working groups (optional)</legend>
        {choicesLoading && <p role="status">Loading working groups…</p>}
        {choicesError && <p role="alert">Could not load groups. <button type="button" onClick={() => void loadChoices()}>Retry</button></p>}
        {groups.map(group => <label key={group.id}><input type="checkbox" checked={selected.includes(group.id)} onChange={event => setSelected(event.target.checked ? [...selected, group.id] : selected.filter(id => id !== group.id))} /><span><strong>{group.name}</strong><small>{group.mission}</small></span></label>)}
        <p className="workspace-muted">You can read every group’s work. Join a group whenever you’re ready to contribute.</p>
      </fieldset>}
      <p className="workspace-muted">Read the <a href="/organizers/privacy" target="_blank" rel="noopener noreferrer">organizer privacy notice</a> before continuing.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-dark" disabled={busy || choicesLoading || choicesError}>{busy ? 'Saving…' : onboarding ? 'Create account and open workspace' : 'Save password'}</button>
    </form>
    <button type="button" className="workspace-text-button" onClick={async () => {
      try {
        const { error } = await client.auth.signOut()
        if (error) setError('Could not sign out. Please retry.')
      } catch { setError('Could not sign out. Please retry.') }
    }}>Sign out</button>
  </section>
}

export default function OrganizerArea({ client = supabase }: { client?: SupabaseClient | null }) {
  const path = window.location.pathname.replace(/\/$/, '')
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [context, setContext] = useState<OrganizerContext | null>(null)
  const [error, setError] = useState('')
  const [nonce, setNonce] = useState(0)
  const [passwordReady, setPasswordReady] = useState(false)
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token_hash'))
  const [tokenType] = useState(() => new URLSearchParams(window.location.search).get('type'))
  const [verified, setVerified] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [tokenError, setTokenError] = useState('')
  const sessionUserId = useRef<string | null>(null)

  useEffect(() => {
    const previousTitle = document.title
    document.title = `${path === '/organizers/privacy' ? 'Organizer privacy notice' : 'Organizer workspace'} — ${privacyController}`
    return () => { document.title = previousTitle }
  }, [path])

  useEffect(() => {
    if (!client) return
    let active = true
    let authEventSeen = false
    const applySession = (next: Session | null) => {
      const nextId = next?.user.id ?? null
      if (sessionUserId.current !== nextId || !next) setContext(null)
      sessionUserId.current = nextId
      setSession(next)
      setAuthLoading(false)
    }
    client.auth.getSession().then(({ data, error: sessionError }) => {
      if (active && !authEventSeen) {
        applySession(data.session)
        if (sessionError) setError('Could not restore your session. Please sign in again.')
      }
    }).catch(() => {
      if (active && !authEventSeen) {
        setAuthLoading(false)
        setError('Could not connect. Please try again.')
      }
    })
    const { data } = client.auth.onAuthStateChange((event, next) => {
      if (event === 'USER_UPDATED') return
      if (active) {
        authEventSeen = true
        // Supabase also emits SIGNED_IN on focus for an unchanged account.
        // Keep the mounted workspace and its drafts when identity stays the same.
        applySession(next)
      }
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [client])

  useEffect(() => {
    if (!client || !session) {
      setContext(null)
      return
    }
    let active = true
    setError('')
    workspaceRpc<OrganizerContext>(client, 'organizer_context').then(next => {
      if (active) setContext(next)
    }).catch(() => {
      if (active) {
        setContext(null)
        setError('Could not verify workspace access. Please retry.')
      }
    })
    return () => { active = false }
  }, [client, session, nonce])

  async function verify() {
    if (!client || !token) return
    const expected = ['/organizers/accept', '/organizers/register'].includes(path) ? 'invite' : path === '/organizers/recovery' ? 'recovery' : null
    if (!expected || tokenType !== expected) {
      setTokenError('This link is invalid. Ask an admin for a new invitation or request another password reset.')
      return
    }
    setVerifying(true)
    setTokenError('')
    try {
      const { data, error: verifyError } = await client.auth.verifyOtp({ token_hash: token, type: expected })
      if (verifyError || !data.session) {
        setTokenError('This link has expired or was already used. Ask an admin for a new invitation or request another password reset.')
        return
      }
      window.history.replaceState({}, '', path)
      setSession(data.session)
      setVerified(true)
    } catch { setTokenError('Could not verify this link. Please try again.') }
    finally { setVerifying(false) }
  }

  if (path === '/organizers/privacy') return <OrganizerPrivacy />
  if (!['/organizers', '/organizers/register', '/organizers/accept', '/organizers/recovery'].includes(path)) return <OrganizerShell><h1>Page not found</h1><a href="/organizers">Open the workspace</a></OrganizerShell>
  if (!client) return <OrganizerShell><h1>Organizer workspace</h1><p role="status">The workspace is being set up. Please check back soon.</p></OrganizerShell>
  if (token && !verified) return <OrganizerShell><section className="workspace-auth"><p className="eyebrow">SEC Padova</p><h1>{path === '/organizers/recovery' ? 'Reset your password.' : 'Create your account.'}</h1><p>{path === '/organizers/recovery' ? 'Continue to verify your email and choose a new password.' : 'You’re invited to the organizer workspace. Continue to verify your invitation, then choose your name, password, and working groups.'}</p>{tokenError && <p className="form-error" role="alert">{tokenError}</p>}<button className="button button-dark" disabled={verifying} onClick={() => void verify()}>{verifying ? 'Verifying…' : 'Continue'}</button><p><a href="/organizers">Back to sign in</a></p></section></OrganizerShell>
  if (authLoading) return <OrganizerShell><p role="status">Restoring your session…</p></OrganizerShell>
  if (!session) return <OrganizerShell>{path === '/organizers/register' ? <RegistrationEntry /> : <Login client={client} />}</OrganizerShell>
  if (error) return <OrganizerShell><p role="alert">{error}</p><button onClick={() => setNonce(nonce + 1)}>Retry</button><button onClick={() => void client.auth.signOut()}>Sign out</button></OrganizerShell>
  if (!context) return <OrganizerShell><p role="status">Checking workspace access…</p></OrganizerShell>
  if (!context.authorized) return <OrganizerShell><section className="workspace-auth"><h1>Organizer access required.</h1><p>This account does not have access. Ask a club admin for an invitation.</p><button className="button button-dark" onClick={() => void client.auth.signOut()}>Sign out</button></section></OrganizerShell>
  if (!context.profile || (path === '/organizers/recovery' && !passwordReady)) return <OrganizerShell><AccountSetup client={client} onboarding={!context.profile} onComplete={async () => {
    setPasswordReady(true)
    setContext(null)
    setNonce(value => value + 1)
    window.history.replaceState({}, '', '/organizers')
  }} /></OrganizerShell>
  return <OrganizerShell><OrganizerWorkspace client={client} context={{ ...context, profile: context.profile }} onAccessChanged={() => {
    setContext(null)
    setNonce(value => value + 1)
  }} /></OrganizerShell>
}
