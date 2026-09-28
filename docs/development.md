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

The frontend uses React, TypeScript, and Vite. `netlify.toml` builds with `npm run build` and publishes `dist`.

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

The Join section requires only an email address when `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are configured. Visitors can optionally provide a phone number using the country calling-code selector (Italy by default) or paste an international number starting with `+`. [libphonenumber-js](https://github.com/catamphetamine/libphonenumber-js) supplies country codes, parses national dialing prefixes, and checks possible number lengths. The browser sends the number in E.164 format; extensions are not supported. Without configuration the section shows a setup message. The browser calls `public.join_interest_list`, which normalizes the address and stores it with the nullable `phone_number` in `private.club_interest`. Duplicate requests succeed without revealing whether an address was already submitted and do not replace existing contact data. Anonymous visitors cannot read, update, or delete the list. No Auth user, password, or member profile is created.

The public list is currently an expression of interest, not a verified newsletter subscription. It does not send mail. Before sending routine updates, add an email ownership confirmation and unsubscribe process. Publish a privacy notice with the club's contact, purpose, retention period, and removal route before collecting real addresses. Do not export or commit addresses to Git.

Local Supabase config disables public Auth sign-ups at the project level while leaving the email provider enabled for future invitations. Turn off **Allow new users to sign up** in the hosted Supabase Auth settings too; a hidden frontend form does not prevent direct Auth API calls. When organizers are ready, build a server-side invitation flow using `inviteUserByEmail`, then collect name, student/external status, optional department and school, and any account credentials during invited onboarding. Keep the Supabase secret key only on a trusted server.

## Hosted configuration

Connect the organization-owned `sec-padova/sec-website` repository to Netlify. Connect the Supabase project to the same GitHub organization repository when ready to deploy reviewed migrations from `main`. Apply all migrations, including `20260928010000_interest_phone.sql`, before deploying the updated form or setting Netlify's browser-safe Supabase environment variables. Disable hosted public Auth sign-ups before publishing the list. The invitation and account flow is a later milestone.

Use `develop`, reviewed `feature/*` branches, and a release branch. Merge tested releases to `main` for production deployment.
