// Shared screens follow the sports an athlete chose at sign-up (athlete_prefs). None is the default for everyone.

/** The first chosen sport that is live, in library order; null when none is, so callers show every sport. */
export function firstSport(chosen: string[], live: { id: string }[]): string | null {
  return live.find((c) => chosen.includes(c.id))?.id ?? null;
}

/** Which progress view opens first: gym for gym-only athletes, else the boxing and S&C view. */
export function progressView(chosen: string[]): 'gym' | 'training' {
  return chosen.includes('gym') && !chosen.includes('boxing') && !chosen.includes('sc') ? 'gym' : 'training';
}

/** What each live path offers, for the landing page and the Learn hub. A new sport falls back to its tagline. */
export const sportPitch: Record<string, string> = {
  boxing: 'Stance, punches, footwork and defence, in order on a skill path.',
  sc: 'Strength, power, speed and conditioning for any sport, or for everyday fitness.',
  gym: 'Hypertrophy, strength and fat loss. Log every set and see what to lift next.',
};
