# Supabase Setup

## 1. Create a Supabase project

1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Create a project.
3. Copy the project URL and publishable key from `Connect` or `Project Settings -> API Keys`.

## 2. Add environment variables

1. Copy [`.env.example`](C:/Users/PC/OneDrive/Documents/Cooley/.env.example) to `.env`.
2. Fill in:

```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

## 3. Run the SQL

Use only one of these paths:

- Fresh Supabase project:
  Run [001_app_schema.sql](C:/Users/PC/OneDrive/Documents/Cooley/supabase/migrations/001_app_schema.sql)
- Existing project that already used the old migration chain:
  Run [002_existing_project_repairs.sql](C:/Users/PC/OneDrive/Documents/Cooley/supabase/migrations/002_existing_project_repairs.sql)

The older numbered migration files were moved to [legacy-migrations](C:/Users/PC/OneDrive/Documents/Cooley/supabase/archive/legacy-migrations) for reference only. New setups should not run them.

## 4. Confirm the backend

After the SQL completes, verify these tables exist in Supabase:

- `profiles`
- `listings`
- `listing_images`
- `applications`
- `threads`
- `thread_members`
- `messages`

## 5. Configure Auth

1. Open `Authentication -> Providers`
2. Enable `Email`
3. Decide whether email confirmation should be required

## 6. Start the app

```bash
npm install
npx expo start -c
```

## 7. Test the important flows

1. Sign up with two accounts
2. Post a listing with photos
3. Open the listing from the other account
4. Apply or instant accept
5. Open `Message requester`
6. Send messages from both sides

## 8. When to use the repair file again

Run [002_existing_project_repairs.sql](C:/Users/PC/OneDrive/Documents/Cooley/supabase/migrations/002_existing_project_repairs.sql) any time you need to repair an older Supabase project that was created from the previous scattered migration set.
