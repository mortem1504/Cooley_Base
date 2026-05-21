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
6. For an existing project, apply only the missing files from [migrations](C:/Users/Acer Nitro/Cooley_Base/supabase/migrations).
   For the current app features, that includes [005_rental_request_flow.sql](C:/Users/Acer Nitro/Cooley_Base/supabase/migrations/005_rental_request_flow.sql) and [006_cancel_request_flow.sql](C:/Users/Acer Nitro/Cooley_Base/supabase/migrations/006_cancel_request_flow.sql) if they are not already installed.
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

## AI Listing Copilot

The Listing Copilot uses a Supabase Edge Function at
[supabase/functions/listing-copilot/index.ts](C:/Users/Acer%20Nitro/Cooley_Base/supabase/functions/listing-copilot/index.ts).

To enable it:

1. Set the OpenAI key as a Supabase secret:

```bash
supabase secrets set OPENAI_API_KEY=your_openai_api_key
```

2. Optionally set a model override:

```bash
supabase secrets set OPENAI_MODEL=gpt-4o-mini
```

3. Deploy the function:

```bash
supabase functions deploy listing-copilot
```

4. Make sure your app is already using the same Supabase project in `.env`.

The mobile app calls the function through the shared Supabase client, so the OpenAI API key never ships to the device.

## Files Related To Supabase

- [`.env.example`](C:/Users/PC/OneDrive/Documents/Cooley/.env.example)
- [supabaseClient.js](C:/Users/PC/OneDrive/Documents/Cooley/src/services/supabaseClient.js)
- [schema.sql](C:/Users/PC/OneDrive/Documents/Cooley/supabase/schema.sql)
- [README.md](C:/Users/PC/OneDrive/Documents/Cooley/supabase/README.md)
