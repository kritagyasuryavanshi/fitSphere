// The coach agreement a coach accepts before their profile goes live (M4-02). The version must equal
// public.current_coach_agreement() in the database. shortcut: a plain draft until the owner's reviewed agreement
// (owner item O-05); bump both versions together when it changes, and every coach accepts again before publishing.
export const COACH_AGREEMENT_VERSION = 'draft-2026-11';

export const COACH_AGREEMENT: [string, string][] = [
  ['Your profile', 'What you say about yourself, your credentials and your results is true. A FitSphere admin checks credentials before they show as checked.'],
  ['Payments', 'Clients pay through FitSphere only. Do not ask a client found here to pay you outside FitSphere.'],
  ['Fees and payouts', 'FitSphere keeps a platform fee from each payment, shown on your profile editor before you publish. You receive the rest after the refund window closes.'],
  ['Coaching', 'Coach within your qualifications. Send injuries and medical questions to a doctor or physiotherapist. Treat every client with respect.'],
  ['Client data', 'Use a client’s data only to coach them, and only while they are your client.'],
  ['Ending', 'You can unpublish your profile at any time; paid periods already started run to their end. FitSphere can suspend a profile that breaks this agreement.'],
];
