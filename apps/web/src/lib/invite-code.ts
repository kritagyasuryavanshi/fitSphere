/** An invite code as it appears in a /join/ URL: 32 lowercase hex characters (the database's own check). */
export const INVITE_CODE = /^[0-9a-f]{32}$/;

/**
 * The code from whatever someone pastes: a full link (with or without the scheme, with a trailing slash or a query),
 * a link inside a chat message, a /join/ path, or the code alone. Null for anything else.
 */
export function inviteCode(text: string): string | null {
  const t = text.trim();
  const inLink = t.match(/\/join\/([0-9a-f]{32})(?![0-9a-f])/i);
  if (inLink) return inLink[1]!.toLowerCase();
  return /^[0-9a-f]{32}$/i.test(t) ? t.toLowerCase() : null;
}
