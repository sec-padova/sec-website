# Student Entrepreneurs Club landing page

A static draft with no build dependencies for a student led University of Padova club. Open `index.html` in a browser, or serve this directory with any static file server. The page loads Google Fonts and has local font fallbacks.

## Confirmed direction

- Use plain HTML, CSS, and JavaScript only if interaction becomes necessary.
- Host on Netlify or Vercel; the domain is still undecided.
- Use English and a bold, energetic, student led visual style.
- Make **Join the club** the primary action. The signup destination will be decided later, so the current links lead to a clearly marked placeholder section.
- Feature events, networking, and student projects as activities available at launch.
- Focus on students while welcoming anyone interested in participating.
- Name University of Padova and [M31](https://www.m31.com/) as approved collaborators.
- Include an expandable, scrollable directory for every club participant, with a placeholder until names are supplied. Social links remain placeholders.

## Current assumptions

- The public name is **Student Entrepreneurs Club**, as used on the [launch event](https://luma.com/pf6b3exb).
- The geometric mark and matching favicon are draft artwork, pending any official logo.
- The Luma launch page is the only verified public destination. It is described as a launch event rather than an upcoming event.
- The page describes collaborating professors in general terms until individual names are confirmed.

## Details needed before launch

1. Replace the join placeholder with the exact form or community URL when chosen.
2. Add public member names to `members.js` and replace the social placeholders with real links.
3. Provide any existing brand assets and individual professor names if desired.
4. Decide the domain and who will maintain events and projects.

The site uses plain HTML, CSS, and a small JavaScript file for the member directory. It can be hosted on GitHub Pages, Netlify, Vercel, or a university web server without a build step.

## Updating the member directory

Add one object per participant to `members.js`:

```js
window.clubMembers = [
  { name: "Ada Example", department: "Engineering", github: "https://github.com/ada-example" },
  { name: "Marco Example", department: "Design" },
];
```

Only `name` is required. `department` and `github` are optional. Add only details approved for public display. The directory sorts names alphabetically and scrolls within a fixed-height panel as it grows.

The eight visible rows are clearly labeled placeholders. As soon as at least one member is added to `members.js`, the script replaces them with the real roster and updates the count.

## Proposed GitHub organization

Use **Student Entrepreneurs Club** as the display name and consider `student-entrepreneurs-padova` as the organization handle. `sec-padova` is a shorter alternative. Check availability in GitHub's organization creation form before choosing; this repository does not contain an organization link yet.
