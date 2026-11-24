import type { Metadata } from 'next';
import { LegalPage, type Sections } from '../legal-page';

export const metadata: Metadata = { title: 'Terms of use · FitSphere' };

// Plain terms for the invite beta (M6-02a). Money terms follow the owner's defaults (O-05). M6-02 swaps in the
// lawyer's text (O-07); the coach agreement wording is O-05b.
const sections: Sections = [
  [
    'The service',
    [
      'FitSphere gives athletes lessons, training programs from their coach, and a log of their training. Coaches build programs, invite athletes and give feedback.',
      'Lessons marked "Sample" are examples, not coaching advice from a named coach.',
      'During the invite beta, coaches can be browsed but not hired, and messages are closed. Ask AI is off.',
    ],
  ],
  [
    'Who can use it',
    [
      'You must be 18 or older. If you are younger, do not create an account; if you did, delete it from your account page.',
      'One account per person. The details you give at sign-up must be true.',
    ],
  ],
  [
    'Train safely',
    [
      'Training carries a risk of injury. Warm up, train within your limits and stop if you feel pain.',
      'FitSphere and its coaches do not give medical advice. For pain or injury, see a doctor or physiotherapist first.',
      'Ask AI answers come from a computer, not a coach. They can be wrong. Check anything that matters with your coach or a doctor.',
    ],
  ],
  [
    'Your account',
    [
      'Keep your sign-in email secure. You are responsible for what is done with your account.',
      'What you log is self-reported. Coaches see it only as the privacy policy says.',
    ],
  ],
  [
    'Coaches',
    [
      'Coaches are approved before they get coach tools. Lessons are checked by a second coach before they go live.',
      'Coaches are responsible for the programs, feedback and coaching they give, and accept the coach agreement before their profile goes live.',
      'Coaches must not ask athletes for payment outside FitSphere for coaching found here.',
    ],
  ],
  [
    'Hiring and payments',
    [
      'When hiring opens, an athlete pays FitSphere for coaching, and FitSphere pays the coach after keeping its 15% fee.',
      'Monthly coaching renews each month until you cancel. Cancelling stops the next renewal; the paid month runs to its end.',
      'A first payment for monthly coaching is refundable in full within 7 days. Renewals are not refundable.',
      'A single session is booked for a time at least 48 hours ahead, and is refundable up to 24 hours before it starts.',
      'A refund goes back to the way you paid.',
    ],
  ],
  [
    'Reviews and messages',
    [
      'Only an athlete who paid for coaching can review it, once. Reviews must be honest and about the coaching.',
      'Do not use messages to harass anyone, to share content you have no right to share, or to take payment outside FitSphere.',
    ],
  ],
  [
    'Fair use',
    [
      'Do not misuse the service, harass others, upload content you have no right to share, or try to reach data that is not yours.',
      'We may remove content or suspend accounts that break these terms. A suspended coach’s paid coaching runs to the end of the paid month.',
    ],
  ],
  [
    'Changes',
    ['We may update these terms as the service grows. The date at the top changes when we do, and we tell you before a change that affects you.'],
  ],
];

export default function TermsPage() {
  return <LegalPage title="Terms of use" updated="23 November 2026" sections={sections} other={{ href: '/legal/privacy', label: 'privacy policy' }} />;
}
