// The answer values for sign-up steps 2 and 3. Server actions accept only these.

export type Option = { value: string; label: string; hint?: string };

export const boxingExperience: Option[] = [
  { value: 'new', label: 'Brand new', hint: 'Never thrown a punch' },
  { value: 'few_classes', label: 'A few classes', hint: 'Know stance and the jab' },
  { value: 'one_year', label: 'Trained 1+ year', hint: 'Comfortable with combos' },
  { value: 'competes', label: 'I spar or compete', hint: 'Looking to sharpen' },
];

export const boxingWants: Option[] = [
  { value: 'technique', label: 'Learn proper technique' },
  { value: 'fitness', label: 'Get fitter' },
  { value: 'strength', label: 'Build strength' },
  { value: 'sparring', label: 'Prepare to spar' },
  { value: 'weight_loss', label: 'Lose weight' },
];

export const trainingDays: Option[] = ['2', '3', '4', '5', '6'].map((d) => ({ value: d, label: d }));

export const equipment: Option[] = [
  { value: 'gloves', label: 'Gloves and wraps' },
  { value: 'heavy_bag', label: 'Heavy bag' },
  { value: 'rope', label: 'Skipping rope' },
  { value: 'weights', label: 'Dumbbells or kettlebell' },
  { value: 'gym', label: 'Gym access' },
];

export const gymGoals: Option[] = [
  { value: 'muscle', label: 'Build muscle', hint: 'Get bigger and more defined' },
  { value: 'fat_loss', label: 'Lose fat', hint: 'Drop weight, keep muscle' },
  { value: 'strength', label: 'Get stronger', hint: 'Lift heavier' },
  { value: 'fitness', label: 'Get fitter', hint: 'More energy and stamina' },
];

export const gymPlaces: Option[] = [
  { value: 'full_gym', label: 'Full gym' },
  { value: 'home', label: 'Home, with dumbbells' },
  { value: 'bodyweight', label: 'Bodyweight only' },
];

export const liftingExperience: Option[] = [
  { value: 'new', label: 'New to it' },
  { value: 'under_1', label: 'Under 1 year' },
  { value: '1_to_3', label: '1 to 3 years' },
  { value: '3_plus', label: '3+ years' },
];

/** The label for a stored value, or the value itself if the list has changed since. */
export function labelOf(options: Option[], value: unknown): string {
  return options.find((o) => o.value === value)?.label ?? String(value ?? '');
}

/** Keeps only known values, so a forged form field never reaches the database. */
export function pick(options: Option[], values: string[]): string[] {
  return values.filter((v, i) => values.indexOf(v) === i && options.some((o) => o.value === v));
}
