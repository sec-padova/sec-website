# Student Entrepreneurs Club

Student led community at the University of Padova. This repository contains the public landing page, now built with React, TypeScript, and Vite. Registration and member profiles are planned but are not live yet.

## Local development

Use Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
```

Run the test suite and production build before each milestone review:

```sh
npm test
npm run build
```

## Hosting

`netlify.toml` builds with `npm run build` and publishes `dist`. The rewrite serves the React app if client-side routes are introduced. Connect the `sec-padova/sec-website` repository to a Netlify site when ready to deploy. The domain is still undecided.

## Member directory

The public directory is expandable and scrollable. It currently shows placeholders. `src/members.ts` contains no personal data. Future Supabase integration will supply only approved members who explicitly opt in to public display. Do not add a private roster to the source code.

## Development roadmap

The baseline static site is committed on `main`. Work proceeds through `develop`, reviewed `feature/*` branches, and a release branch. Each milestone is reviewed and committed by the repository owner before the next begins.

1. React and TypeScript shell with the existing landing page and Netlify build.
2. Supabase PostgreSQL schema, Auth client, row-level security, and access tests.
3. Student and external registration, email verification, sign-in, and password reset.
4. Organizer approval with an audit record.
5. Private member profile editing and opt-in public directory.
6. Netlify release and end-to-end verification over HTTPS.

Supabase Auth will manage passwords. The browser will use only a publishable key; service keys and database credentials must remain outside the repository. Membership will require organizer approval, and profiles will remain private until a member explicitly opts in to the public directory.

The project catalogue and blog are future features and are intentionally absent from this first membership release.
