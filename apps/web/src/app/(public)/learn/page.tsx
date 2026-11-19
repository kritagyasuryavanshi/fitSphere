import { redirect } from 'next/navigation';

// /learn has no page of its own: the library opens on its first sport. Lesson emails fall back to this address.
export default function LearnPage() {
  redirect('/learn/boxing');
}
