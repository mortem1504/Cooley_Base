# Supabase Setup

## Switching To A New Supabase Account

This app already reads Supabase credentials from [`.env`](C:/Users/PC/OneDrive/Documents/Cooley/.env) through [supabaseClient.js](C:/Users/PC/OneDrive/Documents/Cooley/src/services/supabaseClient.js).

To switch accounts or projects safely:

1. Create the new Supabase project in the new account.
2. Copy [`.env.example`](C:/Users/PC/OneDrive/Documents/Cooley/.env.example) to `.env`.
3. Replace the values in `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_publishable_anon_key
```

4. Open the SQL editor in the new Supabase project.
5. For a brand-new project, run [schema.sql](C:/Users/PC/OneDrive/Documents/Cooley/supabase/schema.sql).
6. For an existing project, apply only the missing files from [migrations](C:/Users/PC/OneDrive/Documents/Cooley/supabase/migrations).
7. In Supabase Auth, enable Email auth and set your email confirmation preference.
8. Restart Expo with cache clear:

```bash
npx expo start --clear
```

## Important Notes

- Changing `.env` switches the app to a different backend project.
- Existing users, chats, listings, reviews, and storage files do not move automatically.
- If you need the old data in the new project, export/import has to be done separately in Supabase.
- The app only needs the project URL and publishable anon key on the frontend.

## Minimum Backend Check

After running the schema, verify these exist in the new project:

- `profiles`
- `listings`
- `listing_images`
- `applications`
- `threads`
- `thread_members`
- `messages`
- `rental_requests`
- `rental_reviews`

## Files Related To Supabase

- [`.env.example`](C:/Users/PC/OneDrive/Documents/Cooley/.env.example)
- [supabaseClient.js](C:/Users/PC/OneDrive/Documents/Cooley/src/services/supabaseClient.js)
- [schema.sql](C:/Users/PC/OneDrive/Documents/Cooley/supabase/schema.sql)
- [README.md](C:/Users/PC/OneDrive/Documents/Cooley/supabase/README.md)
