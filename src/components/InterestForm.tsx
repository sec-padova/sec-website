import { useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

interface Props {
  client: SupabaseClient | null
}

export default function InterestForm({ client }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  if (!client) {
    return <p className="interest-note" role="status">The interest list is being set up. Please check back soon.</p>
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!client || submitting) return
    setError('')
    const input = event.currentTarget.elements.namedItem('email') as HTMLInputElement
    const email = input.value.trim().toLowerCase()
    if (!email || email.length > 320 || !input.checkValidity()) {
      setError('Enter a valid email address.')
      return
    }

    setSubmitting(true)
    try {
      const { error: requestError } = await client.rpc('join_interest_list', { p_email: email })
      if (requestError) {
        setError('Could not add your email. Please try again later.')
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Could not add your email. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return <p className="interest-note" role="status">Thanks for your interest. We may email this address with an invitation to join the club later.</p>
  }

  return (
    <form className="interest-form" onSubmit={handleSubmit} noValidate>
      <div className="form-field">
        <label htmlFor="interest-email">Email</label>
        <input id="interest-email" name="email" type="email" autoComplete="email" required maxLength={320} />
      </div>
      <p className="form-help">Leave your email to hear from us when club membership opens.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-dark" type="submit" disabled={submitting}>{submitting ? 'Adding your email…' : 'Join the interest list'} <span aria-hidden="true">↗︎</span></button>
    </form>
  )
}
