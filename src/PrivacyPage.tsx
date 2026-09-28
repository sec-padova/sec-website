import { useEffect } from 'react'
import { privacyContactEmail, privacyController, privacyNoticeVersion } from './privacy'

export default function PrivacyPage() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = `Privacy notice — ${privacyController}`
    return () => { document.title = previousTitle }
  }, [])

  return (
    <main className="privacy-page section-wrap">
      <header className="privacy-header">
        <a className="brand" href="/" aria-label="Student Entrepreneurs Club, home">
          <span className="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
          <span className="brand-name">Student<br />Entrepreneurs Club</span>
        </a>
        <a className="privacy-back" href="/#join">Back to the interest list <span aria-hidden="true">↗</span></a>
      </header>
      <article className="privacy-document">
        <p className="eyebrow">Your contact details</p>
        <h1>Privacy notice</h1>
        <p className="privacy-updated">Version {privacyNoticeVersion} · Updated 28 September 2026</p>
        <p className="privacy-intro">This notice explains how we use the contact details you provide when joining our membership interest list. You can browse the website without joining the list.</p>

        <section aria-labelledby="privacy-controller">
          <h2 id="privacy-controller">Who is responsible</h2>
          <p>{privacyController}, based in Padova, Italy, is the controller responsible for the interest list. Our privacy contact is <a href={`mailto:${privacyContactEmail}`}>{privacyContactEmail}</a>.</p>
        </section>

        <section aria-labelledby="privacy-data">
          <h2 id="privacy-data">What we collect and why</h2>
          <p>We collect your email address and, if you choose to provide it, your phone number. We also record when you joined, the time of your consent, and the version of this notice shown when you submitted the form.</p>
          <p>We use these details to contact you about membership openings and an invitation to join the club. Providing a phone number allows us to contact you by phone as well as email. Your phone number is optional and leaving it blank does not affect your request.</p>
          <p>This form does not create a user account or enrol you in an advertising or general newsletter mailing list. We do not sell your contact details or publish them in the member directory.</p>
        </section>

        <section aria-labelledby="privacy-basis">
          <h2 id="privacy-basis">Your consent</h2>
          <p>We process your interest-list details on the basis of your consent under Article 6(1)(a) GDPR. The checkbox is unchecked by default, and joining the list is voluntary.</p>
          <p>You can withdraw your consent at any time by emailing our privacy contact and asking to leave the interest list. Withdrawal does not affect the lawfulness of processing before you withdrew.</p>
        </section>

        <section aria-labelledby="privacy-storage">
          <h2 id="privacy-storage">Where your information goes</h2>
          <p>Authorised club organisers can access the interest list to handle membership invitations and privacy requests. Registration details are stored in a private Supabase database hosted in Ireland. Visitors cannot read the contact list through the website.</p>
          <p>Netlify hosts this website. Netlify and Supabase may process technical request information, such as IP addresses and browser information, to deliver and protect their services. Website delivery and security support our legitimate interests under Article 6(1)(f) GDPR.</p>
          <p>These providers and their subprocessors may process some information outside the European Economic Area, including in the United States. Their agreements describe international-transfer safeguards, including standard contractual clauses and applicable adequacy decisions. See <a href="https://supabase.com/legal/customer-resources/data-processing-addendum" target="_blank" rel="noopener noreferrer">Supabase’s data processing addendum</a> and <a href="https://www.netlify.com/privacy/" target="_blank" rel="noopener noreferrer">Netlify’s privacy policy</a> for details.</p>
        </section>

        <section aria-labelledby="privacy-retention">
          <h2 id="privacy-retention">How long we keep it</h2>
          <p>We keep your interest-list contact details and consent record for a maximum of 12 months from your original submission. We remove them earlier if you withdraw your consent or request erasure, subject to applicable legal requirements.</p>
          <p>Technical service logs and any provider backups follow the providers’ retention and deletion procedures. If you later become a member, we will provide information about any separate processing needed for membership.</p>
        </section>

        <section aria-labelledby="privacy-rights">
          <h2 id="privacy-rights">Your rights and how to contact us</h2>
          <p>You can request access to your data, correction, erasure, restriction of processing, or a portable copy where the applicable GDPR conditions are met. You can also object to processing based on legitimate interests.</p>
          <p>Email <a href={`mailto:${privacyContactEmail}`}>{privacyContactEmail}</a> to exercise your rights or withdraw consent. We may need to verify that a request concerns your data before disclosing or changing it. We respond without undue delay and normally within one month.</p>
          <p>You can lodge a complaint with the Italian <a href="https://www.garanteprivacy.it/" target="_blank" rel="noopener noreferrer">Garante per la protezione dei dati personali</a>, or the supervisory authority in the EU country where you live or work.</p>
        </section>
      </article>
      <footer className="privacy-footer"><a href="/#join">Return to the interest list <span aria-hidden="true">↗</span></a><span>{privacyController} · Padova, Italy</span></footer>
    </main>
  )
}
