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

## Local database

Start Docker Desktop, then run:

```sh
npm run db:start
npm run db:test
npm run db:stop
```

`npm run db:reset` recreates only the local Supabase database from the migrations and removes local data. Database tests cover profile privacy, organizer privileges, approval protection, public directory opt-in, and allowed department values.

Copy `.env.example` to `.env.local` and fill in the project URL and browser-safe publishable key. Vite exposes variables prefixed with `VITE_` to the browser. Never put a Supabase secret key, database password, or service-role key in those variables or in Git.

## Membership data

Supabase Auth manages credentials. `public.member_profiles` stores club details and starts each person in `pending` status with public directory opt-in off. Organizers are listed in `public.organizers`; a project owner grants the first organizer by adding the existing Auth user ID through the SQL editor. Do not add an organizer grant to browser code.

Department is optional for students and external members. Use the shared select component in the registration form, with options from `public.unipd_departments`; the database rejects values outside that list. Its 32 English names follow the [University of Padova department list](https://www.unipd.it/en/dipartimenti), checked on 25 September 2026. Review the list when the university changes its departments.

The public directory contains only approved members who explicitly opt in. Do not add a private member roster to source files.

## Hosted configuration

Connect the organization-owned `sec-padova/sec-website` repository to Netlify. Connect the Supabase project to the same GitHub organization repository when ready to deploy reviewed migrations from `main`. Configure email confirmation, approved redirect URLs, and a production SMTP sender before opening registration. The local Supabase setup sends email to Mailpit.

Use `develop`, reviewed `feature/*` branches, and a release branch. Merge tested releases to `main` for production deployment.
