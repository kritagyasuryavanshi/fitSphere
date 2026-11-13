// One @, no spaces, and a dot inside the domain. Strict enough for a typo check; the email link proves the rest.
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Returns the trimmed, lowercased address, or null when it is not a full email address. */
export function normaliseEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}
