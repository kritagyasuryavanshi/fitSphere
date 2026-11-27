-- Multi-sport focus: S&C serves any sport, and the gym path names hypertrophy.
update public.categories set tagline = 'Strength and power for any sport' where id = 'sc';
update public.categories set tagline = 'Hypertrophy, strength, fat loss' where id = 'gym';
