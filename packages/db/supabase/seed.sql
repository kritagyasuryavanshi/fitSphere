-- Local and CI test users. All share the password "password123". Never run this against production.
-- The role sits in user metadata until M1-01 adds the user_roles table.
with seed(id, email, role) as (
  values
    ('00000000-0000-0000-0000-000000000001'::uuid, 'athlete@test.fitsphere', 'athlete'),
    ('00000000-0000-0000-0000-000000000002'::uuid, 'coach1@test.fitsphere', 'coach'),
    ('00000000-0000-0000-0000-000000000003'::uuid, 'coach2@test.fitsphere', 'coach'),
    ('00000000-0000-0000-0000-000000000004'::uuid, 'reviewer@test.fitsphere', 'reviewer'),
    ('00000000-0000-0000-0000-000000000005'::uuid, 'admin@test.fitsphere', 'admin')
), users as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    -- GoTrue fails on null token columns, so they must be empty strings.
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('role', role), now(), now(),
    '', '', '', ''
  from seed
  returning id, email
)
insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, 'email',
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), now(), now(), now()
from users;
