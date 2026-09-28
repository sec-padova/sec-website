import { useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import { privacyNoticeVersion } from '../privacy'

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' })
const countries = getCountries()
  .map(code => ({ code, name: countryNames.of(code) ?? code, callingCode: getCountryCallingCode(code) }))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'))

interface Props {
  client: SupabaseClient | null
}

export default function InterestForm({ client }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [country, setCountry] = useState<CountryCode>('IT')
  const [phoneError, setPhoneError] = useState('')
  const [consentError, setConsentError] = useState('')

  if (!client) {
    return <div className="interest-note" role="status"><span className="interest-status-mark" aria-hidden="true">✳</span><p>The interest list is being set up. Please check back soon.</p></div>
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!client || submitting) return
    setError('')
    setPhoneError('')
    setConsentError('')
    const input = event.currentTarget.elements.namedItem('email') as HTMLInputElement
    const email = input.value.trim().toLowerCase()
    if (!email || email.length > 320 || !input.checkValidity()) {
      setError('Enter a valid email address.')
      return
    }

    const phoneInput = event.currentTarget.elements.namedItem('phone') as HTMLInputElement
    const phone = phoneInput.value.trim()
    let phoneNumber: string | null = null
    if (phone) {
      const parsed = parsePhoneNumberFromString(phone, { defaultCountry: country, extract: false })
      if (!parsed || !parsed.isPossible() || parsed.ext || !/^\+[1-9]\d{1,14}$/.test(parsed.number)) {
        setPhoneError('Enter a complete phone number with the correct country code, or leave it blank.')
        phoneInput.focus()
        return
      }
      phoneNumber = parsed.number
    }

    const consentInput = event.currentTarget.elements.namedItem('privacy-consent') as HTMLInputElement
    if (!consentInput.checked) {
      setConsentError('Please give your consent before joining the interest list.')
      consentInput.focus()
      return
    }

    setSubmitting(true)
    try {
      const { error: requestError } = await client.rpc('join_interest_list', {
        p_email: email,
        p_phone_number: phoneNumber,
        p_privacy_notice_version: privacyNoticeVersion,
        p_consent: true,
      })
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
    return <div className="interest-note interest-success" role="status"><span className="interest-status-mark" aria-hidden="true">✓</span><h4>You’re on the list.</h4><p>Thanks for your interest. We may email this address with an invitation to join the club later.</p></div>
  }

  return (
    <form className="interest-form" onSubmit={handleSubmit} noValidate>
      <div className="form-field">
        <div className="form-label-row"><label htmlFor="interest-email">Email</label><span className="field-required">Required</span></div>
        <div className="form-input-wrap">
          <svg className="form-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>
          <input id="interest-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={320} />
        </div>
      </div>
      <fieldset className="phone-fields">
        <legend className="visually-hidden">Optional phone contact</legend>
        <div className="phone-input-row">
          <div className="form-field">
            <label htmlFor="interest-phone-country">Country code</label>
            <div className="form-select-wrap">
              <select id="interest-phone-country" name="phone-country" value={country} onChange={event => setCountry(event.target.value as CountryCode)} autoComplete="tel-country-code">
                {countries.map(({ code, name, callingCode }) => <option key={code} value={code}>{name} (+{callingCode})</option>)}
              </select>
              <svg className="form-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="interest-phone">Phone number <span>(optional)</span></label>
            <input id="interest-phone" name="phone" type="tel" autoComplete="tel" placeholder="Your number" maxLength={64} aria-describedby={phoneError ? 'interest-phone-help interest-phone-error' : 'interest-phone-help'} aria-invalid={phoneError ? true : undefined} />
          </div>
        </div>
        <p className="form-help" id="interest-phone-help">Choose a country code or paste a full number starting with +.</p>
        {phoneError && <p className="form-error" id="interest-phone-error" role="alert">{phoneError}</p>}
      </fieldset>
      <div className="privacy-consent">
        <div className="consent-option">
          <input id="interest-consent" name="privacy-consent" type="checkbox" required aria-describedby={consentError ? 'interest-consent-help interest-consent-error' : 'interest-consent-help'} aria-invalid={consentError ? true : undefined} />
          <label htmlFor="interest-consent">I consent to the club using my contact details to contact me about membership.</label>
        </div>
        <p id="interest-consent-help" className="form-help">Read our <a href="/privacy" target="_blank" rel="noopener noreferrer">privacy notice</a>. You can withdraw your consent at any time.</p>
        {consentError && <p id="interest-consent-error" className="form-error" role="alert">{consentError}</p>}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-dark" type="submit" disabled={submitting}>{submitting ? 'Adding your email…' : 'Join the interest list'} <span aria-hidden="true">↗︎</span></button>
    </form>
  )
}
