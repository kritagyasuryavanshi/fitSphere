/** The 32-hex code from a pasted invite link, a /join/ path, or the code alone; null for anything else. */
export function inviteCode(text: string): string | null {
  const m = text.trim().match(/^(?:(?:https?:\/\/[^/\s]+)?\/join\/)?([0-9a-f]{32})(?:[?#]\S*)?$/i);
  return m ? m[1].toLowerCase() : null;
}
