-- M2-02: sample content for Boxing, S&C and Gym. Every row is is_sample, so pages label it "Sample"
-- and the AI never cites it. A coach replaces each sample through review.
-- Samples have no video yet: invented YouTube ids would embed someone else's video.
-- shortcut: sample items have no video, add one when a founding coach films it.
-- Idempotent: an existing slug is left alone, so a re-run never overwrites a coach's change.

create function public.seed_sample_content()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  gym_dose constant jsonb := '[
    {"goal": "build_muscle", "reps": "8-12", "sets": "3-4", "rest": "90 s", "effort": "Stop 1-2 reps before failure"},
    {"goal": "get_stronger", "reps": "3-6", "sets": "3-5", "rest": "2-3 min", "effort": "Heavy, with clean form"},
    {"goal": "lose_fat", "reps": "10-15", "sets": "3", "rest": "60 s", "effort": "Pair with conditioning"}]';
  data constant jsonb := '[
    {"slug": "stance", "cat": "boxing", "disc": "technical", "kind": "skill", "title": "Stance", "level": "beginner", "min": 6, "type": "technical",
     "summary": "The base every punch starts from. Balanced, side-on and ready to move.",
     "steps": ["Stand with your feet shoulder-width apart, lead foot forward.", "Turn your rear foot out to about 45 degrees and lift the rear heel a little.", "Bend your knees slightly and keep your weight in the middle.", "Tuck your chin and keep your shoulders relaxed."],
     "mistakes": "Feet in one line, so you tip over. Locked knees. Weight on the heels.", "safety": "Warm up your ankles and hips first. Stop if a knee hurts."},
    {"slug": "guard", "cat": "boxing", "disc": "technical", "kind": "skill", "title": "Guard", "level": "beginner", "min": 6, "type": "technical", "prereq": ["stance"],
     "summary": "Hands up, elbows in. The guard protects your head and body between punches.",
     "steps": ["From your stance, raise both fists to cheek height.", "Keep your elbows in front of your ribs.", "Hold the lead hand a little forward and the rear hand by your chin.", "Look over the top of your gloves."],
     "mistakes": "Hands drop when tired. Elbows flare out. Chin lifts up.", "safety": "Keep the shoulders loose so the neck does not tense."},
    {"slug": "jab", "cat": "boxing", "disc": "technical", "kind": "skill", "title": "The Jab", "level": "beginner", "min": 8, "type": "technical", "prereq": ["guard"],
     "summary": "The lead-hand straight punch. It finds the range and sets up everything else.",
     "steps": ["Start in your stance with your guard up.", "Push off the rear foot and extend the lead hand straight out.", "Turn the fist palm-down as the arm straightens.", "Bring the hand straight back to the guard."],
     "mistakes": "Dropping the rear hand. Pulling the jab back low. Leaning forward past the lead foot.", "safety": "Do not lock the elbow at full reach. Wrap your hands for bag work."},
    {"slug": "cross", "cat": "boxing", "disc": "technical", "kind": "skill", "title": "The Cross", "level": "beginner", "min": 9, "type": "technical", "prereq": ["jab"],
     "summary": "The rear-hand straight punch. Power comes from the back foot and the hips.",
     "steps": ["Start in your stance with your guard up.", "Pivot the rear foot and turn the rear hip forward.", "Extend the rear hand straight, palm-down.", "Return to the guard along the same line."],
     "mistakes": "Punching with the arm only. Lifting the rear heel too late. Dropping the lead hand.", "safety": "Build speed before power. Wrap your hands and wear gloves on the bag."},
    {"slug": "footwork-basics", "cat": "boxing", "disc": "footwork", "kind": "skill", "title": "Footwork basics", "level": "beginner", "min": 10, "type": "technical", "prereq": ["cross"],
     "summary": "Step and drag to move in every direction without crossing your feet.",
     "steps": ["To go forward, step with the lead foot and drag the rear foot after it.", "To go back, step with the rear foot first.", "To go sideways, move the foot on that side first.", "Keep the same stance width after every step."],
     "mistakes": "Crossing the feet. Jumping instead of stepping. Feet ending too close together.", "safety": "Train on a dry, flat floor. Keep the steps small at first."},
    {"slug": "pivot", "cat": "boxing", "disc": "footwork", "kind": "skill", "title": "The Pivot", "level": "intermediate", "min": 7, "type": "technical", "prereq": ["footwork-basics"],
     "summary": "Turn on the lead foot to change angle and step out of the line of attack.",
     "steps": ["Put your weight on the ball of the lead foot.", "Swing the rear foot around in a quarter circle.", "Turn your shoulders with your feet.", "Finish back in a full stance at the new angle."],
     "mistakes": "Pivoting on the heel. Turning the feet but not the shoulders. Losing the guard.", "safety": "Pivot on a surface with some grip, not socks on tiles."},
    {"slug": "lead-hook", "cat": "boxing", "disc": "technical", "kind": "skill", "title": "The Lead Hook", "level": "beginner", "min": 9, "type": "technical", "prereq": ["footwork-basics"],
     "summary": "A short, curved punch with the lead hand, driven by turning the lead foot and hip.",
     "steps": ["Start in your stance with your guard up.", "Bend the lead arm to about 90 degrees at shoulder height.", "Pivot the lead foot and turn the hips to swing the arm across.", "Return to the guard at once."],
     "mistakes": "Winding up first. Opening the elbow too wide. Rear hand leaves the chin.", "safety": "Keep the wrist straight on impact. Start slow on the bag."},
    {"slug": "rear-uppercut", "cat": "boxing", "disc": "technical", "kind": "skill", "title": "The Rear Uppercut", "level": "intermediate", "min": 8, "type": "technical", "prereq": ["lead-hook"],
     "summary": "An upward punch with the rear hand, driven by the legs, for close range.",
     "steps": ["Dip slightly by bending the knees.", "Drive up through the rear leg and turn the hip.", "Bring the rear fist up, palm facing you.", "Return to the guard."],
     "mistakes": "Dropping the hand low before the punch. Leaning back. Swinging from far away.", "safety": "Do not throw full power until the movement is smooth."},
    {"slug": "one-two", "cat": "boxing", "disc": "combinations", "kind": "skill", "title": "The 1-2 combo", "level": "beginner", "min": 8, "type": "technical", "prereq": ["cross"],
     "summary": "The jab then the cross. The first punch finds the range, the second lands.",
     "steps": ["Throw a jab from your stance.", "As the jab returns, pivot and throw the cross.", "Keep the lead hand up while the cross goes out.", "Return to the guard and reset your feet."],
     "mistakes": "Pausing between punches. Leaning in on the cross. Rear hand drops on the jab.", "safety": "Keep the rhythm controlled before you add speed."},
    {"slug": "slip", "cat": "boxing", "disc": "defence", "kind": "skill", "title": "Slipping the jab", "level": "beginner", "min": 7, "type": "technical", "prereq": ["guard"],
     "summary": "Move the head just off the line of a straight punch, so it misses.",
     "steps": ["From your stance, bend the knees a little.", "Rotate the shoulders to move the head a few centimetres to the outside.", "Keep your eyes on your partner.", "Come back to the centre ready to punch."],
     "mistakes": "Bending at the waist. Moving too far. Closing the eyes.", "safety": "Practise slowly with a partner who throws light punches only."},
    {"slug": "parry", "cat": "boxing", "disc": "defence", "kind": "skill", "title": "The Parry", "level": "beginner", "min": 6, "type": "technical", "prereq": ["guard"],
     "summary": "Redirect a straight punch with a small push of the glove.",
     "steps": ["Hold your guard up.", "As the jab comes, push it to the side with the rear glove.", "Move the hand only a few centimetres.", "Return the hand to the chin."],
     "mistakes": "Reaching out to meet the punch. Moving the hand too far. Looking away.", "safety": "Start with slow punches from a partner you trust."},
    {"slug": "heavy-bag-rhythm", "cat": "boxing", "disc": "technical", "kind": "drill", "title": "Heavy bag rhythm", "level": "beginner", "min": 12, "type": "conditioning", "equip": ["heavy_bag"], "prereq": ["one-two"],
     "summary": "Three-minute rounds of jabs and crosses on the bag, moving between combos.",
     "steps": ["Wrap your hands and put on bag gloves.", "Circle the bag and throw a 1-2 every few steps.", "Reset your stance after every combo.", "Rest one minute between rounds."],
     "mistakes": "Standing still. Pushing the bag instead of snapping punches. Holding the breath.", "safety": "Always wrap your hands. Stop if a wrist or knuckle hurts."},
    {"slug": "shadow-boxing", "cat": "boxing", "disc": "technical", "kind": "drill", "title": "Shadow boxing rounds", "level": "beginner", "min": 10, "type": "technical", "prereq": ["jab"],
     "summary": "Box with no target to groove technique, footwork and breathing.",
     "steps": ["Set a three-minute round timer.", "Move with footwork basics and throw single punches.", "Add a slip or parry after each punch.", "Rest one minute between rounds."],
     "mistakes": "Throwing at full speed with sloppy form. Forgetting the feet.", "safety": "Do not snap the elbow straight with no target."},
    {"slug": "skipping", "cat": "boxing", "disc": "footwork", "kind": "drill", "title": "Skipping rope", "level": "beginner", "min": 10, "type": "conditioning", "equip": ["skipping_rope"],
     "summary": "Light, quick skipping for footwork rhythm and conditioning.",
     "steps": ["Hold the handles at hip height.", "Turn the rope from the wrists, not the shoulders.", "Hop just high enough to clear it, on the balls of the feet.", "Skip for one minute, rest 30 seconds, repeat."],
     "mistakes": "Jumping too high. Landing on the heels. Big arm circles.", "safety": "Skip on a wooden floor or mat, not concrete."},

    {"slug": "kettlebell-swing", "cat": "sc", "disc": "power", "kind": "exercise", "title": "Kettlebell swing", "level": "intermediate", "min": 6, "equip": ["kettlebell"], "supports": ["punching_power"], "prereq": ["barbell-deadlift"],
     "summary": "A hip hinge that drives the bell with your glutes. The same hip snap powers a hard cross.",
     "steps": ["Feet a little wider than hips, bell in front.", "Hike the bell back between the legs.", "Snap the hips forward. Arms only guide.", "Let the bell float to chest height."],
     "dose": [{"label": "A typical dose", "value": "3 x 15", "note": "Rest 60 s between sets."}],
     "mistakes": "Squatting instead of hinging. Lifting with the arms. Rounding the back.", "safety": "Learn the hinge first. Start light. Stop if your lower back hurts."},
    {"slug": "barbell-deadlift", "cat": "sc", "disc": "strength", "kind": "exercise", "title": "Barbell deadlift", "level": "intermediate", "min": 8, "equip": ["barbell"], "supports": ["stance_stability", "leg_drive"],
     "summary": "Lift the bar from the floor with a flat back. Builds the legs and hips that hold your stance.",
     "steps": ["Stand with the bar over the middle of your feet.", "Hinge down and grip the bar just outside your legs.", "Brace your core and push the floor away.", "Stand tall, then lower the bar the same way."],
     "dose": [{"label": "A typical dose", "value": "4 x 5", "note": "Rest 2 min between sets."}],
     "mistakes": "Rounding the back. Bar drifting away from the legs. Jerking the bar off the floor.", "safety": "Start with a light bar. Keep the back flat. Stop if you feel sharp pain."},
    {"slug": "battle-rope-intervals", "cat": "sc", "disc": "conditioning", "kind": "exercise", "title": "Battle rope intervals", "level": "beginner", "min": 10, "equip": ["battle_ropes"], "supports": ["round_endurance"],
     "summary": "Hard 30-second rope waves that copy the work and rest of a boxing round.",
     "steps": ["Hold one rope end in each hand, knees bent.", "Make fast alternating waves for 30 seconds.", "Rest 30 seconds.", "Repeat for six rounds."],
     "dose": [{"label": "A typical dose", "value": "6 x 30 s", "note": "Rest 30 s between rounds."}],
     "mistakes": "Standing straight up. Waves only from the hands. Holding the breath.", "safety": "Keep the knees soft and the back neutral."},
    {"slug": "plank-variations", "cat": "sc", "disc": "core", "kind": "exercise", "title": "Plank variations", "level": "beginner", "min": 6, "supports": ["core_control"],
     "summary": "Front and side planks that teach the trunk to stay stiff while you punch.",
     "steps": ["Set your forearms under your shoulders.", "Make one straight line from head to heels.", "Hold for 30 seconds, then switch to a side plank on each side.", "Breathe slowly throughout."],
     "dose": [{"label": "A typical dose", "value": "3 x 30 s each", "note": "Rest 30 s between holds."}],
     "mistakes": "Hips sagging. Hips piked high. Holding the breath.", "safety": "Stop if the lower back aches. Shorten the hold instead."},
    {"slug": "goblet-squat", "cat": "sc", "disc": "strength", "kind": "exercise", "title": "Goblet squat", "level": "beginner", "min": 6, "equip": ["dumbbell"], "supports": ["leg_drive"],
     "summary": "A squat holding one weight at the chest. Builds the leg drive behind every punch.",
     "steps": ["Hold a dumbbell upright against your chest.", "Feet shoulder-width, toes slightly out.", "Sit down between your heels with the chest up.", "Drive up through the whole foot."],
     "dose": [{"label": "A typical dose", "value": "3 x 10", "note": "Rest 90 s between sets."}],
     "mistakes": "Heels lifting. Knees caving in. Chest dropping forward.", "safety": "Squat only as deep as you can with a flat back."},
    {"slug": "guard-push-up", "cat": "sc", "disc": "strength", "kind": "exercise", "title": "Push-up", "level": "beginner", "min": 5, "supports": ["guard_endurance"],
     "summary": "The bodyweight press that keeps your shoulders strong enough to hold the guard up.",
     "steps": ["Hands under the shoulders, body in one line.", "Lower the chest to just above the floor.", "Keep the elbows at about 45 degrees.", "Press back up to straight arms."],
     "dose": [{"label": "A typical dose", "value": "3 x 12", "note": "Rest 60 s between sets."}],
     "mistakes": "Hips sagging. Elbows flared wide. Half reps.", "safety": "Do them on your knees if a full push-up hurts your shoulders."},
    {"slug": "med-ball-rotational-throw", "cat": "sc", "disc": "power", "kind": "exercise", "title": "Med-ball rotational throw", "level": "intermediate", "min": 6, "equip": ["med_ball"], "supports": ["punching_power"],
     "summary": "Throw a medicine ball sideways at a wall, turning from the hips like a hook.",
     "steps": ["Stand side-on to a solid wall, ball at the hip.", "Load the back hip.", "Turn the hips and throw the ball hard into the wall.", "Catch it and reset."],
     "dose": [{"label": "A typical dose", "value": "3 x 6 each side", "note": "Rest 60 s between sets."}],
     "mistakes": "Throwing with the arms only. Feet not turning. Using a ball that is too heavy.", "safety": "Use a soft ball and a solid wall. Clear the area around you."},
    {"slug": "pallof-press", "cat": "sc", "disc": "core", "kind": "exercise", "title": "Pallof press", "level": "beginner", "min": 5, "equip": ["band"], "supports": ["core_control"],
     "summary": "Press a band straight out and resist the pull. Trains the trunk to stop rotation.",
     "steps": ["Anchor a band at chest height and stand side-on to it.", "Hold the band at your chest with both hands.", "Press it straight out and hold for two seconds.", "Bring it back without turning."],
     "dose": [{"label": "A typical dose", "value": "3 x 10 each side", "note": "Rest 45 s between sets."}],
     "mistakes": "Turning toward the anchor. Leaning away. Shrugging the shoulders.", "safety": "Check the band and anchor before each set."},
    {"slug": "hip-mobility-flow", "cat": "sc", "disc": "mobility", "kind": "exercise", "title": "Hip mobility flow", "level": "beginner", "min": 8, "type": "mobility", "supports": ["stance_stability"],
     "summary": "A short flow that opens the hips so you can pivot and stay low.",
     "steps": ["Kneel in a lunge and push the hips forward for 30 seconds.", "Move to a 90-90 sit and switch sides slowly.", "Finish with deep squat holds.", "Repeat the flow twice."],
     "dose": [{"label": "A typical dose", "value": "2 rounds", "note": "Move slowly and breathe."}],
     "mistakes": "Forcing the range. Rushing the switches. Holding the breath.", "safety": "Stretch to mild tension, never to pain."},

    {"slug": "barbell-bench-press", "cat": "gym", "disc": "chest", "kind": "exercise", "title": "Barbell bench press", "level": "intermediate", "min": 7, "equip": ["barbell", "bench", "rack"], "env": ["full_gym"], "muscles": ["chest", "front_shoulders", "triceps"], "alts": ["dumbbell-bench-press", "push-up", "cable-fly"],
     "summary": "The main upper-body push. Press the bar from your chest to straight arms while your back stays tight on the bench.",
     "steps": ["Eyes under the bar, feet flat, shoulder blades pulled together.", "Grip a little wider than your shoulders.", "Lower the bar to the middle of your chest, elbows at about 45 degrees.", "Press up and slightly back until your arms are straight."],
     "mistakes": "Bouncing the bar off the chest. Elbows flared wide. Hips lifting off the bench.", "safety": "Set the safety arms in the rack, or train with a spotter. Never use a thumbless grip."},
    {"slug": "dumbbell-bench-press", "cat": "gym", "disc": "chest", "kind": "exercise", "title": "Dumbbell bench press", "level": "beginner", "min": 6, "equip": ["dumbbells", "bench"], "env": ["full_gym", "home_dumbbells"], "muscles": ["chest", "front_shoulders", "triceps"],
     "summary": "A bench press with two dumbbells. Each arm works on its own.",
     "steps": ["Sit with the dumbbells on your thighs, then lie back.", "Hold them over your chest, palms forward.", "Lower them to the sides of your chest.", "Press them back up until the arms are straight."],
     "mistakes": "Dropping the dumbbells too low. Clashing them at the top. Arching the back hard.", "safety": "Pick a weight you can control. Lower the dumbbells to your thighs before you sit up."},
    {"slug": "push-up", "cat": "gym", "disc": "chest", "kind": "exercise", "title": "Push-up", "level": "beginner", "min": 5, "env": ["full_gym", "home_dumbbells", "bodyweight"], "muscles": ["chest", "triceps", "front_shoulders"],
     "summary": "The bodyweight chest press you can do anywhere.",
     "steps": ["Hands under the shoulders, body in one line.", "Lower the chest to just above the floor.", "Keep the elbows at about 45 degrees.", "Press back up to straight arms."],
     "mistakes": "Hips sagging. Elbows flared wide. Half reps.", "safety": "Do them with hands on a bench if a full push-up is too hard."},
    {"slug": "incline-dumbbell-press", "cat": "gym", "disc": "chest", "kind": "exercise", "title": "Incline dumbbell press", "level": "intermediate", "min": 6, "equip": ["dumbbells", "bench"], "env": ["full_gym", "home_dumbbells"], "muscles": ["upper_chest", "front_shoulders", "triceps"],
     "summary": "A dumbbell press on a raised bench that works the upper chest.",
     "steps": ["Set the bench to about 30 degrees.", "Hold the dumbbells over your upper chest.", "Lower them to the sides of the upper chest.", "Press them back up."],
     "mistakes": "Bench set too steep. Bouncing at the bottom. Shoulders shrugging.", "safety": "Keep the weight light enough to control the bottom."},
    {"slug": "cable-fly", "cat": "gym", "disc": "chest", "kind": "exercise", "title": "Cable fly", "level": "beginner", "min": 5, "equip": ["cable_machine"], "env": ["full_gym"], "muscles": ["chest"],
     "summary": "Bring two cable handles together in an arc to work the chest.",
     "steps": ["Set both pulleys at shoulder height and take a handle in each hand.", "Step forward with a slight bend in the elbows.", "Bring the hands together in front of your chest.", "Open the arms slowly to the start."],
     "mistakes": "Bending the elbows into a press. Using too much weight. Leaning forward a lot.", "safety": "Keep a staggered stance so the cables cannot pull you off balance."},
    {"slug": "lat-pulldown", "cat": "gym", "disc": "back", "kind": "exercise", "title": "Lat pulldown", "level": "beginner", "min": 6, "equip": ["cable_machine"], "env": ["full_gym"], "muscles": ["lats", "biceps", "upper_back"],
     "summary": "Pull a bar down to your chest to build the back.",
     "steps": ["Sit with your thighs under the pads and grip the bar wide.", "Lean back a little and pull the bar to your upper chest.", "Squeeze the shoulder blades down.", "Let the bar rise slowly."],
     "mistakes": "Pulling behind the neck. Swinging the body. Letting the bar snap up.", "safety": "Keep the bar in front of the head."},
    {"slug": "barbell-row", "cat": "gym", "disc": "back", "kind": "exercise", "title": "Barbell row", "level": "intermediate", "min": 7, "equip": ["barbell"], "env": ["full_gym"], "muscles": ["upper_back", "lats", "biceps"],
     "summary": "Row a bar to your belly while bent over. Builds a thick upper back.",
     "steps": ["Hinge forward with a flat back, bar hanging at the knees.", "Pull the bar to your lower ribs.", "Squeeze the shoulder blades together.", "Lower the bar under control."],
     "mistakes": "Rounding the back. Standing up as you pull. Jerking the weight.", "safety": "Keep the back flat. Use a lighter bar if the lower back tires."},
    {"slug": "back-squat", "cat": "gym", "disc": "legs", "kind": "exercise", "title": "Back squat", "level": "intermediate", "min": 8, "equip": ["barbell", "rack"], "env": ["full_gym"], "muscles": ["quads", "glutes", "lower_back"],
     "summary": "Squat with a bar on your upper back. The main lift for leg strength.",
     "steps": ["Set the bar on your upper back and step out of the rack.", "Brace your core.", "Sit down between your heels, knees over the toes.", "Stand up through the whole foot."],
     "mistakes": "Knees caving in. Heels lifting. Chest dropping.", "safety": "Squat inside a rack with the safety arms set just below your lowest point."},
    {"slug": "romanian-deadlift", "cat": "gym", "disc": "legs", "kind": "exercise", "title": "Romanian deadlift", "level": "intermediate", "min": 7, "equip": ["barbell"], "env": ["full_gym"], "muscles": ["hamstrings", "glutes", "lower_back"],
     "summary": "A hip hinge with soft knees that works the hamstrings.",
     "steps": ["Stand tall holding the bar at your thighs.", "Push the hips back with soft knees.", "Lower the bar along the legs until you feel the hamstrings stretch.", "Drive the hips forward to stand."],
     "mistakes": "Rounding the back. Squatting the weight down. Bar drifting forward.", "safety": "Stop the bar where your back starts to round."},
    {"slug": "overhead-press", "cat": "gym", "disc": "shoulders", "kind": "exercise", "title": "Overhead press", "level": "intermediate", "min": 6, "equip": ["barbell"], "env": ["full_gym"], "muscles": ["front_shoulders", "side_shoulders", "triceps"],
     "summary": "Press a bar from your shoulders to overhead while standing.",
     "steps": ["Hold the bar at your collarbones, hands just outside the shoulders.", "Squeeze the glutes and brace.", "Press the bar straight up, moving the head back out of the way.", "Lower it to the collarbones."],
     "mistakes": "Leaning back a lot. Pressing forward of the head. Flaring the ribs.", "safety": "Start light. Stop if the shoulder pinches."},
    {"slug": "dumbbell-curl", "cat": "gym", "disc": "arms", "kind": "exercise", "title": "Dumbbell curl", "level": "beginner", "min": 5, "equip": ["dumbbells"], "env": ["full_gym", "home_dumbbells"], "muscles": ["biceps", "forearms"],
     "summary": "Curl two dumbbells to build the biceps.",
     "steps": ["Stand tall, dumbbells at your sides, palms forward.", "Bend the elbows to bring the weights up.", "Keep the elbows by your ribs.", "Lower them slowly."],
     "mistakes": "Swinging the body. Elbows moving forward. Dropping the weight fast.", "safety": "Pick a weight you can lift without swinging."}
  ]';
  r jsonb;
  new_id uuid;
begin
  for r in select value from jsonb_array_elements(data) loop
    new_id := null;
    insert into public.content_items (discipline_id, kind, slug, title, summary, level, duration_min, equipment, environments, drill_type, supports, mistakes, safety, dose, is_sample, status, published_at)
    values (
      (select id from public.disciplines where category_id = r->>'cat' and slug = r->>'disc'),
      (r->>'kind')::public.content_kind, r->>'slug', r->>'title', r->>'summary', (r->>'level')::public.content_level, (r->>'min')::smallint,
      array(select jsonb_array_elements_text(coalesce(r->'equip', '[]'))),
      array(select jsonb_array_elements_text(coalesce(r->'env', '[]'))),
      r->>'type',
      array(select jsonb_array_elements_text(coalesce(r->'supports', '[]'))),
      r->>'mistakes', r->>'safety',
      coalesce(r->'dose', case when r->>'cat' = 'gym' then gym_dose else '[]' end),
      true, 'published', now())
    on conflict (slug) do nothing
    returning id into new_id;
    -- An existing slug keeps its own steps and muscles.
    if new_id is not null then
      insert into public.content_steps (item_id, position, body)
        select new_id, s.n, s.body from jsonb_array_elements_text(r->'steps') with ordinality s(body, n);
      insert into public.content_muscles (item_id, muscle_id, is_primary)
        select new_id, m.id, m.n = 1 from jsonb_array_elements_text(coalesce(r->'muscles', '[]')) with ordinality m(id, n);
    end if;
  end loop;

  -- Links after every item exists, by slug.
  insert into public.content_links (from_id, to_id, kind, sort)
    select f.id, t.id, l.kind::public.content_link_kind, l.n
    from jsonb_array_elements(data) e(item)
    cross join lateral (
      select value, 'prerequisite', n from jsonb_array_elements_text(coalesce(e.item->'prereq', '[]')) with ordinality p(value, n)
      union all
      select value, 'alternative', n from jsonb_array_elements_text(coalesce(e.item->'alts', '[]')) with ordinality a(value, n)
    ) l(slug, kind, n)
    join public.content_items f on f.slug = e.item->>'slug'
    join public.content_items t on t.slug = l.slug
  on conflict do nothing;
end;
$$;
revoke execute on function public.seed_sample_content() from public, anon, authenticated;

select public.seed_sample_content();
