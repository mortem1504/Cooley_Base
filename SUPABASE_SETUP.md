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

The current Listing Copilot calls a Supabase Edge Function at
[supabase/functions/listing-copilot/index.ts](C:/Users/Acer%20Nitro/Cooley_Base/supabase/functions/listing-copilot/index.ts),
and that function calls the Google Gemini API.

To enable it:

1. Create a Gemini API key in Google AI Studio.
2. Store it as a Supabase secret:

```bash
npx supabase secrets set GEMINI_API_KEY=your_gemini_api_key
```

3. Optionally set a model override:

```bash
npx supabase secrets set GEMINI_MODEL=gemini-3.5-flash
```

4. Deploy or redeploy the function:

```bash
npx supabase functions deploy listing-copilot
```

Notes:

- Keep the Gemini key server-side only. Do not place it in the Expo app.
- The post screen still uses the same suggestion shape through
  [src/services/listingCopilotService.js](C:/Users/Acer%20Nitro/Cooley_Base/src/services/listingCopilotService.js).
- Gemini has a free tier, but free-tier limits depend on the model and project limits in Google AI Studio.

## Files Related To Supabase

- [`.env.example`](C:/Users/PC/OneDrive/Documents/Cooley/.env.example)
- [supabaseClient.js](C:/Users/PC/OneDrive/Documents/Cooley/src/services/supabaseClient.js)
- [schema.sql](C:/Users/PC/OneDrive/Documents/Cooley/supabase/schema.sql)
- [README.md](C:/Users/PC/OneDrive/Documents/Cooley/supabase/README.md)
