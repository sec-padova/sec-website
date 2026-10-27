# Development guide

This guide covers the website's local setup and deployment. Keep member data, credentials, and local environment files out of Git.

## Frontend

Use Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
npm test
npm run build
```

The frontend uses React, TypeScript, and Vite. `netlify.toml` builds with `npm run build` and publishes `dist`. DM Sans and Space Grotesk are served locally from `public/fonts`, with their SIL Open Font License files, so page views do not contact Google Fonts. Font source files come from the [Google Fonts repository](https://github.com/google/fonts).

## Upcoming events

Add events approved for display to `src/events.ts`. Each entry needs a title, `startsAt` date and time with a timezone offset, location, and short description. An HTTPS event or registration `url` is optional until registration is available; without it, upcoming events show a disabled registration placeholder. Invalid supplied URLs stay hidden. Use `endsAt` when an event should remain visible until it finishes; otherwise it becomes a past event after its start. Dates and times are displayed in the Padova timezone.

The earliest upcoming event is featured first, with an optional local `poster` (`src`, `alt`, `width`, `height`). More upcoming events follow in date order, then the three most recent completed events. An empty upcoming list shows the existing announcement placeholder. If the event platform hides the address until registration, keep it out of the source file too. Use canonical event URLs without invite or tracking parameters.

For embedded Luma registration, set both the HTTPS Luma `url` and its `lumaEventId` from the event's embed snippet. `LumaCheckoutLink` loads the official `https://embed.lu.ma/checkout-button.js` once when an upcoming registration button mounts, then reinitializes it for newly mounted buttons. It uses Luma's data attributes with the site's own button class, so provider button styles do not override the design. The normal link remains a fallback before the script loads or if it fails; past events use ordinary links. Registration is handled by Luma, separately from the membership interest-list form. The script is not loaded on the privacy page. See [Luma's embed documentation](https://help.luma.com/p/embed-luma-on-your-website).

Homepage motion uses native CSS smooth scrolling, with 24px anchor spacing, and `useScrollReveal` attached to the landing page's main element. Mark individual content groups with `data-reveal` and optional `data-reveal-delay="80"` or `"160"`; avoid nested reveal targets. Content stays visible without IntersectionObserver, reveals once, and becomes immediately visible on keyboard focus. Reduced-motion preferences disable scrolling/entrance movement and stop pending reveals when enabled during a session. Fine-pointer hover adds short button/link feedback and a single poster wobble; the poster's stationary outer wrapper owns hover while the inner frame rotates. No animation library is required.

## Local database

Start Docker Desktop, then run:

```sh
npm run db:start
npm run db:test
npm run db:stop
```

`npm run db:reset` recreates only the local Supabase database from the migrations and removes local data. Database tests cover interest-list privacy and idempotence, plus the future member data model's profile privacy, organizer privileges, approval protection, public directory opt-in, and allowed department values.

Copy `.env.example` to `.env.local` and fill in the project URL and browser-safe publishable key. Vite exposes variables prefixed with `VITE_` to the browser. Never put a Supabase secret key, database password, or service-role key in those variables or in Git.

## Membership data

The member data model is reserved for the invitation phase. Supabase Auth will manage credentials when accounts open. `public.member_profiles` stores club details and starts each person in `pending` status with public directory opt-in off. Organizers are listed in `public.organizers`; a project owner grants the first organizer by adding the existing Auth user ID through the SQL editor. Do not add an organizer grant to browser code.

Department will be optional for students and external members when profiles open. Use the shared select component in profile onboarding, with options from `public.unipd_departments`; the database rejects values outside that list. Its 32 English names follow the [University of Padova department list](https://www.unipd.it/en/dipartimenti), checked on 25 September 2026. Review the list when the university changes its departments.

The public directory contains only approved members who explicitly opt in. Do not add a private member roster to source files.

## Organizer workspace

The invitation-only workspace lives at `/organizers`. The sign-in screen links to **Create your account** at `/organizers/register`. A registration link in an admin-approved invitation verifies the invited email, then collects first name, last name, a password of at least 12 characters, and optional working groups. Invitees enter immediately after completing registration, without another approval step. Visiting the registration page without an invitation explains how to obtain one; it never enables public signup or grants organizer access. Existing `/organizers/accept` invitation links remain supported. This is separate from future club membership: it does not collect affiliation, department, or school and does not publish anyone in the public member directory. Organizer profiles live in `private.organizer_profiles`; invited Auth accounts skip the future club-member profile trigger. Existing complete club-member account creation still works.

Spaces, Events, Marketing, and Management are seeded with missions but no fabricated work. Their overview cards have equal, bounded heights. Compact member rosters scroll within each card; selecting a person opens their full current-work summary and next steps in a dialog. Recent updates and publishing open in a separate dialog, so adding members or updates never expands the grid. Any group member may edit another member’s summary or publish an update about them. Updates record both subject and actual author and cannot be edited or deleted through the application. Revision checks prevent stale summaries or group settings from overwriting newer ones. Refresh loads newer data without replacing drafts; **Load latest** explicitly replaces a draft.

Every onboarded organizer can read all current and archived groups. Self-selecting a group grants editing there. Organizers without a group have the same read access and may join a group later; no separate role or roster is assigned to them. An archived group retains its roster and history but disallows content changes and membership changes until reopened. **Leave group** opens a second confirmation dialog; **Stay in group**, Close, or Escape cancels without changing membership. Only **Confirm leave** removes membership and the current summary. Published updates remain. The confirmation stays open on failure and prevents duplicate requests while saving. Revocation removes the organizer profile, memberships, and summaries. Historical updates retain name snapshots. Admins should review stored history annually and handle deletion/anonymization requests through trusted database administration as appropriate. Accounts remain in Supabase Auth when workspace access is revoked, so other club services are not implicitly deleted.

Admin is an additional private permission. Admins can belong to groups and edit them normally; they cannot edit another group’s work merely because they are admins. Admins manage ordinary organizer invitations, access, memberships, and group lifecycle. Only admins can load account emails, invitation records, and admin assignments. The project owner chooses admin appointments outside the website. The application prevents revoking the last admin. Do not add admin flags to user metadata or the shared roster.

Workspace tables have no browser read/write grants or RLS policies permitting direct access. Browser operations use checked, security-definer RPCs with an empty search path. `organizer_context` exposes only the caller’s own access state. Group choices are available before onboarding only to authenticated invitees; full work and rosters require completed onboarding. RPCs check current database grants on every request, including requests from an already issued session after revocation.

### Initial organizer and admin setup

Apply `20261012010000_organizer_workspace.sql` first. For a **new** initial account, authorize its email through trusted SQL before sending its Auth invitation:

```sql
insert into private.workspace_invitations (email)
values ('owner-approved-email@example.com');
```

Use `auth.admin.inviteUserByEmail` from a trusted server with `redirectTo` set to `https://sec-padova.netlify.app/organizers/register`. The account-creation trigger consumes the trusted authorization and adds the account to `public.organizers`. The invitee accepts the email and completes name/password registration. Never run this operation with browser credentials or commit real email addresses.

For an **existing** Auth account, add its ID to `public.organizers` through trusted SQL; the user can sign in and complete organizer onboarding. To appoint a chosen organizer as an admin after onboarding:

```sql
insert into private.workspace_admins (id)
values ('<existing public.organizers user ID>');
```

Remove an admin appointment through trusted SQL by deleting that ID from `private.workspace_admins`. Verify another onboarded admin remains. Role metadata is never accepted as authorization.

### Invitations and local email testing

The `organizer-invite` Edge Function verifies the bearer JWT using Supabase Auth and checks the caller’s live admin grant before preparing or sending an invitation. Its gateway JWT check is disabled because the handler performs validation itself. Set `ORGANIZER_SITE_URL` to the exact frontend origin, without a path. `ORGANIZER_ALLOWED_ORIGINS` optionally lists additional explicit frontend origins separated by commas, for example loopback URLs while sharing a local preview. It never accepts a wildcard; invitation links still point to `ORGANIZER_SITE_URL`. Function credentials use Supabase’s server-side `SUPABASE_SERVICE_ROLE_KEY`, or `SUPABASE_SECRET_KEY` when provided. They never belong in a `VITE_` variable.

Invitation authorization is persisted before delivery. A failed send leaves a record that an admin can retry or revoke. Duplicate requests do not create duplicate grants. Unconfirmed accounts receive another invitation; confirmed accounts receive a password setup/recovery email and can also sign in normally. Re-authorizing a revoked account requires an explicit new admin invitation. The invitation-record label **Access authorized** refers to access approval, not proof of email delivery or onboarding completion.

Keep public Auth signup disabled. Configure the Invite and Reset Password templates using `supabase/templates/organizer-invite.html` and `supabase/templates/organizer-recovery.html`. Their links go to the application with `token_hash` and the matching `invite`/`recovery` type. Tokens are verified only after **Continue** is clicked and then removed from the URL. Avoid email-provider link tracking. Configure the production Site URL and allowlist these exact redirects:

- `https://sec-padova.netlify.app/organizers/accept`
- `https://sec-padova.netlify.app/organizers/register`
- `https://sec-padova.netlify.app/organizers/recovery`

Configure production SMTP before sending real invitations. Local config uses the bundled templates and Supabase’s email test service; no real emails are sent locally. Use the same host for Vite, the function’s `ORGANIZER_SITE_URL`, and the email redirect. For example:

```sh
npm run db:start
# Create an ignored supabase/.env.local containing only:
# ORGANIZER_SITE_URL=http://127.0.0.1:5173
npx supabase functions serve organizer-invite --env-file supabase/.env.local
npm run dev -- --host 127.0.0.1
```

Inspect local messages at `http://127.0.0.1:54324`. Acceptance and recovery are separate screens. Password reset responses do not disclose whether an email has an account. Use disposable test identities only, and remove their Auth accounts and invitation records after manual tests. Database tests use rollback transactions.

### Sharing a preview while hosting everything on the Mac

The frontend and Supabase stay local. Remote testers can reach them through a temporary Cloudflare Quick Tunnel; requests pass through Cloudflare, without deploying the app or database. Keep the Mac awake and connected, and keep Vite, Supabase, the invitation function, and the tunnel running. A new tunnel creates a new URL.

Opt into the restricted development proxy with `VITE_LOCAL_PREVIEW=true`. The browser then connects to `/supabase` on its own origin, rather than trying to reach `127.0.0.1` on the tester’s machine. The proxy forwards only browser Auth, REST, and Functions routes to the fixed local Supabase API. Auth administration, Studio, filesystem access, sensitive dotfiles, and Supabase source/configuration are blocked. Production builds ignore the preview flag and retain HTTPS validation.

For a remote preview on port 5174:

```sh
cloudflared tunnel --url http://127.0.0.1:5174 --no-autoupdate --protocol http2
# Use the exact generated hostname; do not set allowedHosts: true.
VITE_LOCAL_PREVIEW=true LOCAL_PREVIEW_HOST=<generated-hostname> npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Set the invitation function’s `ORGANIZER_SITE_URL` to the generated HTTPS origin. Add that exact origin’s `/organizers/register`, `/organizers/accept`, and `/organizers/recovery` URLs to local Supabase Auth’s redirect allowlist and restart local Supabase with data preserved to apply it. These are temporary runtime settings; keep the generated hostname out of committed configuration. Restart the locally served invitation function after changing its environment. Keep public signup disabled.

Local email messages remain in the Mac’s Mailpit inbox; the tunnel does not expose that inbox. An admin can invite a test email, copy its personal registration link from the local inbox, and forward that link to the chosen tester. Do not claim an email was delivered to a real inbox when using local Mailpit. Shared demo accounts are for fake data only, and their changes are visible to other testers. Keep demo credentials and temporary tester messages out of Git.

### Workspace release checks

Run `npm test`, `npm run build`, and `npm run db:test`. The frontend test command also runs the invitation-handler unit tests; the Edge Function entrypoint uses the Supabase Deno runtime. Deploy migrations, then the function (`npx supabase functions deploy organizer-invite`), email templates, server secrets/site origin, and redirect settings before releasing the frontend. Do not reset production data. Verify an invited organizer can onboard, read all groups, and edit only joined groups; verify an organizer without groups and an admin outside a group cannot edit its content.

The countdown uses the next valid public event in `src/events.ts`, in Europe/Rome time. It shows an underway state until the event ends, then advances or displays an empty state. Change event data through the existing release process. The workspace privacy notice is `/organizers/privacy`; its purposes are separate from interest-list consent, whose notice version remains unchanged.

## Interest list

The Join section requires an email address and an unchecked-by-default consent checkbox when `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are configured. Phone is optional, using the country calling-code selector (Italy by default) or an international number starting with `+`. [libphonenumber-js](https://github.com/catamphetamine/libphonenumber-js) supplies country codes, parses national dialing prefixes, and checks possible number lengths. The browser sends the number in E.164 format; extensions are not supported. Without configuration the section shows a setup message. The browser calls `public.join_interest_list` with email, phone, notice version, and explicit consent. The database rejects missing/false consent and an unknown notice version, then stores the normalized details with a server-side `consented_at` timestamp and `privacy_notice_version` in `private.club_interest`. Duplicate requests succeed without revealing whether an address was already submitted and do not replace contact data or historical consent evidence. Anonymous visitors cannot read, update, or delete the list. No Auth user, password, or member profile is created.

The privacy notice at `/privacy` identifies Student Entrepreneurs Club as controller and uses `m.bustaffa@gmail.com` as the owner-approved public privacy contact. It covers consent for email and optional phone contact about membership, a maximum retention period of 12 months from the original submission, withdrawal, providers, and GDPR rights. Keep `src/privacy.ts`, the published notice, and the RPC's accepted notice version in sync when the purposes or terms change.

The public list is an expression of interest, not a verified newsletter subscription. It does not send mail. Checkbox consent records a submission, not proof of email ownership. Before sending general newsletters or advertising, add a separate appropriate consent and email confirmation process. Do not export or commit submitted contact details to Git. Entries collected before the consent migration retain null consent fields; review them separately rather than retrospectively claiming consent. Anonymous duplicate submissions intentionally cannot update these records.

The `club-interest-retention` cron job calls `private.remove_expired_interest()` hourly. It deletes rows whose 12-month deadline occurs before the next hourly run, including legacy records; it does not affect membership tables. Monitor its history in Supabase's Cron dashboard and investigate failed or missed runs. Organizers must monitor the privacy-contact mailbox, verify ownership where appropriate, handle withdrawals/erasure requests promptly, and delete the matching interest-list row. Retention cleanup also deletes the consent fields stored in that row. Provider logs and backups follow provider procedures.

Deploy the consent migration and matching frontend together: the migration deliberately removes the old two-argument RPC, so an older deployed form stops accepting registrations once it is applied. The migration does not backfill consent or send confirmation emails. Run the database tests in a local Supabase instance or a transaction that is rolled back before deploying; the tests must not leave fake registrations behind.

Local Supabase config disables public Auth sign-ups at the project level while leaving the email provider enabled for invitations. Turn off **Allow new users to sign up** in the hosted Supabase Auth settings too; a hidden frontend form does not prevent direct Auth API calls. Organizer workspace invitations and minimal onboarding are implemented separately, as described above. General club-member invitations remain a future feature: that flow will need name, student/external status, optional department and school, and appropriate account onboarding. Keep the Supabase secret key only on a trusted server.

## Hosted configuration

The public site is [sec-padova.netlify.app](https://sec-padova.netlify.app), linked to the organization-owned `sec-padova/sec-website` repository's `main` branch. Netlify builds frontend pushes automatically, but Supabase migrations are applied separately. Keep the project-wide Powered by Netlify badge disabled in Netlify's general project configuration. Apply all migrations, including the consent, retention, and organizer workspace migrations, in coordination with the matching frontend release. Netlify uses only the browser-safe Supabase URL and publishable key; organizer invitation credentials belong only in the Supabase Edge Function environment. Hosted public Auth sign-ups are disabled; keep them disabled for invitation-only organizer access and public interest submissions. General club-member account onboarding is a later milestone.

Use `develop`, reviewed `feature/*` branches, and a release branch. Merge tested releases to `main` for production deployment.
