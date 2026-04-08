# Supabase Layout

## Use This File First

- `schema.sql`
  Use this when you want to initialize a fresh Cooley database in one pass.

## Keep These For History

- `migrations/001_app_schema.sql`
- `migrations/002_existing_project_repairs.sql`
- `migrations/003_username_login_lookup.sql`
- `migrations/004_username_support.sql`
- `migrations/005_rental_request_flow.sql`
- `migrations/006_public_profile_reviews.sql`
- `migrations/007_profile_id_card_fields.sql`
- `migrations/008_profile_badges_and_university.sql`

## Rule Of Thumb

- New project: run `schema.sql`
- Existing project: apply only the missing files in `migrations/`
