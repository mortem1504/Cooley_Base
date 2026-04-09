# Cooley

Cooley is a mobile student marketplace built with Expo and Supabase. It connects students with quick campus jobs, item rentals, messaging, reviews, and public profiles.

## Project Structure

- `App.js`, `index.js`, `app.json`
  App entrypoints and Expo configuration.
- `assets/`
  Shared app assets used by Expo and the UI.
- `src/components/`
  Reusable UI building blocks such as cards, buttons, avatars, and listing rows.
- `src/hooks/`
  Shared React hooks.
- `src/navigation/`
  Route constants and navigator setup.
- `src/redux/`
  App-wide state and context.
- `src/screens/`
  Feature screens such as auth, discovery, chat, post job, and profile.
- `src/services/`
  Supabase-facing data access and domain services.
- `src/utils/`
  Formatters, theme tokens, and presentation helpers.
- `supabase/migrations/`
  Historical SQL migrations in the order they were added.
- `supabase/schema.sql`
  One-shot consolidated schema for fresh setup.

## Local Development

Install dependencies:

```bash
npm install
```

Start Expo:

```bash
npm start
```

Start Expo with tunnel:

```bash
npm run tunnel
```

## Database

For a fresh Supabase project, use:

- `supabase/schema.sql`

For migration history and incremental changes, keep:

- `supabase/migrations/*.sql`

Current schema coverage includes:

- auth profile sync
- job and rental listings
- applications
- chat threads and messages
- rental request flow
- public profile reviews
- username login support
- profile card fields

## Cleanup Notes

This repo now uses the root `assets/` folder as the actual asset source.

Low-risk cleanup already applied:

- removed unused `src/services/messageService.js`
- removed placeholder `src/assets/README.md`
- added consolidated `supabase/schema.sql`
- added structure docs for `src/` and `supabase/`