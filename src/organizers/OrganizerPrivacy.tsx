import { privacyContactEmail, privacyController } from '../privacy'

export default function OrganizerPrivacy() {
  return (
    <main className="privacy-page section-wrap">
      <header className="privacy-header"><a href="/organizers">← Organizer workspace</a><a href="/">Club website</a></header>
      <article className="privacy-document">
        <p className="eyebrow">Working together</p><h1>Organizer privacy notice</h1>
        <p className="privacy-updated">Updated 12 October 2026</p>
        <p>{privacyController}, based in Padova, Italy, is responsible for this workspace. Contact <a href={`mailto:${privacyContactEmail}`}>{privacyContactEmail}</a> for privacy questions.</p>
        <section><h2>Your account and work</h2><p>We store your invited email address, name, account authentication information, group memberships, work summaries, and dated updates. Supabase Auth manages passwords; they are never displayed to the club. We do not ask for your department or student/external affiliation.</p><p>We use this information to provide access and coordinate the club’s work, based on our legitimate interest in organizing the project under Article 6(1)(f) GDPR. This is separate from consent for the public membership interest list.</p></section>
        <section><h2>Who can see it</h2><p>Authorized organizers can see names, memberships, work summaries, and updates across all groups. Members of a group can edit that group’s summaries and publish updates. Admins can manage invitations, access, and groups. Account emails, invitation records, and admin assignments are restricted to admins.</p></section>
        <section><h2>Storage and retention</h2><p>Netlify hosts the website and Supabase stores account and workspace data. See our <a href="/privacy">website privacy notice</a> for provider information and international transfers.</p><p>When access is revoked, your workspace profile, memberships, and current summaries are removed. Past updates retain author and subject names so the team can understand its history. Your Supabase account may remain for separate club services. Admins should review the workspace annually and remove historical data when it is no longer needed. You can request earlier deletion or anonymization through our privacy contact. Provider logs and backups follow their own procedures.</p></section>
        <section><h2>Your rights</h2><p>You can request access, correction, erasure, restriction, or portability where applicable, and object to processing based on legitimate interests. Contact our privacy email; we may need to verify your identity. You may also complain to the Italian <a href="https://www.garanteprivacy.it/" target="_blank" rel="noopener noreferrer">Garante per la protezione dei dati personali</a>.</p></section>
      </article>
    </main>
  )
}
