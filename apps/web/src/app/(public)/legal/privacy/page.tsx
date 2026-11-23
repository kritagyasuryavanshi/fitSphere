import type { Metadata } from 'next';
import { LegalPage, type Sections } from '../legal-page';

export const metadata: Metadata = { title: 'Privacy policy · FitSphere' };

// What the app stores, who sees it and how long it stays, kept in step with the schema (M6-02a). Every table with
// personal data is named here. M6-02 swaps in the lawyer's text (O-07).
const sections: Sections = [
  [
    'Who we are',
    [
      'FitSphere is a training app for boxing, strength and gym athletes and their coaches, run from India.',
      'You must be 18 or older to use FitSphere during the beta. We ask your date of birth at sign-up and do not keep the account of anyone younger.',
    ],
  ],
  [
    'What we collect',
    [
      'Account: your email address, name, date of birth, roles and the sports you train.',
      'Sign-up answers: goal, days per week, equipment, and any limits or injuries you choose to share.',
      'Body: body weight and height, only if you enter them, and pain reports you log during a session.',
      'Training: programs you join, your session logs (rounds, sets, reps, loads, effort, technique feel, notes), saved and completed lessons, and extra training you add to Today.',
      'Coaching: feedback from your coach and your replies, hire requests, coaches you shortlist, messages, reviews, and the reason you give when you cancel coaching.',
      'Money: orders, payments, refunds, subscriptions and, for coaches, payouts. Card and bank details stay with the payment provider; we never see them.',
      'Coaches also give us a coach application, a public profile, packages, available times, credentials and the lessons they write.',
      'Ask AI: the questions you ask and the answers.',
      'Records we keep to run the service safely: your consent choices with their dates, email and in-app notifications we send you, and an admin action log.',
    ],
  ],
  [
    'Who sees it',
    [
      'You see everything you entered, and you can download it.',
      'A coach sees your training logs and feedback from their own programs only, never another coach’s. When you leave a program, its coach stops seeing that program’s logs and feedback at once.',
      'A coach also sees your profile, sign-up answers, body weight and height while you are in at least one of their programs. That stops once you have left all of that coach’s programs.',
      'A coach you hire sees your training logs and sign-up answers only if you agree to share them, and only while the coaching is paid and running.',
      'Messages are seen by the two people in the chat. A review shows in public with your first name and last initial. A coach never sees your cancel reason.',
      'A coach’s profile, packages, checked credentials and published lessons are public.',
      'FitSphere admins can see accounts to run the service, for example to approve coaches, refund a payment or act on a report.',
      'We do not sell your data and we do not show you advertising.',
    ],
  ],
  [
    'Service providers',
    [
      'Supabase stores the database in Mumbai, India.',
      'Vercel runs the website. Pages can be served from its servers outside India.',
      'Resend sends our emails. It receives your email address and the email text, in the USA.',
      'Sentry, when we add it, receives error reports from the app to help us fix bugs.',
      'Ask AI is off during the beta. When it opens, your question goes to an AI provider outside India (Anthropic in the USA) to write the answer. Your injury notes or body measurements go with it only if you turn that on.',
      'Razorpay, when payments open, takes card and UPI payments in India and pays coaches.',
      'Each provider uses your data only to give us its service.',
    ],
  ],
  [
    'Your consent and how to withdraw it',
    [
      'We ask before we use your data for each purpose, and we record the date of each choice.',
      'Turn each AI switch and each email on or off on your account and Notifications pages. A change stops future use at once. It does not undo use before the change.',
      'Stop sharing your training with a hired coach at any time, and leave any program to end that coach’s access to it.',
    ],
  ],
  [
    'How long we keep it',
    [
      'We keep your data while your account is open.',
      'When you delete your account, we remove your profile, answers, body data, logs, saves, notifications, Ask AI questions, the reviews you wrote and the messages you sent.',
      'Messages the other person sent stay in their chat. Your name is removed from them.',
      'Orders, payments, refunds and payouts stay for as long as tax law requires, with your name removed.',
      'The admin action log keeps an account id, not your name.',
      'Sent email records are deleted after 90 days.',
    ],
  ],
  [
    'Your rights',
    [
      'Download all your data from your account page at any time.',
      'Correct your name on your account page. Write to the grievance officer to correct anything else.',
      'Delete your account from your account page. If you are a coach with clients or money still owed to you, we ask you to settle those first.',
      'Name someone to act for you if you cannot, by writing to the grievance officer.',
    ],
  ],
  [
    'Questions and complaints',
    [
      'Our grievance officer is the founder of FitSphere. The contact email is published here before the beta opens.',
      'If you are not happy with our answer, you can complain to the Data Protection Board of India.',
    ],
  ],
  [
    'If something goes wrong',
    [
      'If your data is exposed in a breach, we tell you and the Data Protection Board of India without delay: what happened, what it means for you and what we are doing about it.',
    ],
  ],
  [
    'Changes',
    ['We update this policy as the service grows. The date at the top changes when we do, and we tell you before a change that affects you.'],
  ],
];

export default function PrivacyPage() {
  return <LegalPage title="Privacy policy" updated="23 November 2026" sections={sections} other={{ href: '/legal/terms', label: 'terms of use' }} />;
}
