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

Add events approved for display to `src/events.ts`. Each entry needs a title, `startsAt` date and time with a timezone offset, location, short description, and HTTPS event or registration URL. Use `endsAt` when an event should remain visible until it finishes. The page shows the three most recent completed events in gray before upcoming events sorted by start time. Incomplete entries stay hidden. Dates and times are displayed in the Padova timezone. An empty upcoming list shows a "details coming soon" message instead of a fabricated event. If the event platform hides the address until registration, keep it out of the source file too. Use canonical event URLs without invite or tracking parameters.

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

## Interest list

The Join section requires an email address and an unchecked-by-default consent checkbox when `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are configured. Phone is optional, using the country calling-code selector (Italy by default) or an international number starting with `+`. [libphonenumber-js](https://github.com/catamphetamine/libphonenumber-js) supplies country codes, parses national dialing prefixes, and checks possible number lengths. The browser sends the number in E.164 format; extensions are not supported. Without configuration the section shows a setup message. The browser calls `public.join_interest_list` with email, phone, notice version, and explicit consent. The database rejects missing/false consent and an unknown notice version, then stores the normalized details with a server-side `consented_at` timestamp and `privacy_notice_version` in `private.club_interest`. Duplicate requests succeed without revealing whether an address was already submitted and do not replace contact data or historical consent evidence. Anonymous visitors cannot read, update, or delete the list. No Auth user, password, or member profile is created.

The privacy notice at `/privacy` identifies Student Entrepreneurs Club as controller and uses `m.bustaffa@gmail.com` as the owner-approved public privacy contact. It covers consent for email and optional phone contact about membership, a maximum retention period of 12 months from the original submission, withdrawal, providers, and GDPR rights. Keep `src/privacy.ts`, the published notice, and the RPC's accepted notice version in sync when the purposes or terms change.

The public list is an expression of interest, not a verified newsletter subscription. It does not send mail. Checkbox consent records a submission, not proof of email ownership. Before sending general newsletters or advertising, add a separate appropriate consent and email confirmation process. Do not export or commit submitted contact details to Git. Entries collected before the consent migration retain null consent fields; review them separately rather than retrospectively claiming consent. Anonymous duplicate submissions intentionally cannot update these records.

The `club-interest-retention` cron job calls `private.remove_expired_interest()` hourly. It deletes rows whose 12-month deadline occurs before the next hourly run, including legacy records; it does not affect membership tables. Monitor its history in Supabase's Cron dashboard and investigate failed or missed runs. Organizers must monitor the privacy-contact mailbox, verify ownership where appropriate, handle withdrawals/erasure requests promptly, and delete the matching interest-list row. Retention cleanup also deletes the consent fields stored in that row. Provider logs and backups follow provider procedures.

Deploy the consent migration and matching frontend together: the migration deliberately removes the old two-argument RPC, so an older deployed form stops accepting registrations once it is applied. The migration does not backfill consent or send confirmation emails. Run the database tests in a local Supabase instance or a transaction that is rolled back before deploying; the tests must not leave fake registrations behind.

Local Supabase config disables public Auth sign-ups at the project level while leaving the email provider enabled for future invitations. Turn off **Allow new users to sign up** in the hosted Supabase Auth settings too; a hidden frontend form does not prevent direct Auth API calls. When organizers are ready, build a server-side invitation flow using `inviteUserByEmail`, then collect name, student/external status, optional department and school, and any account credentials during invited onboarding. Keep the Supabase secret key only on a trusted server.

## Hosted configuration

The public site is [sec-padova.netlify.app](https://sec-padova.netlify.app), linked to the organization-owned `sec-padova/sec-website` repository's `main` branch. Netlify builds frontend pushes automatically, but Supabase migrations are applied separately. Keep the project-wide Powered by Netlify badge disabled in Netlify's general project configuration. Apply all migrations, including the consent and retention migrations, in coordination with the matching frontend release. Netlify uses only the browser-safe Supabase URL and publishable key. Hosted public Auth sign-ups are disabled; keep them disabled while the site collects interest rather than creating accounts. The invitation and account flow is a later milestone.

Use `develop`, reviewed `feature/*` branches, and a release branch. Merge tested releases to `main` for production deployment.
