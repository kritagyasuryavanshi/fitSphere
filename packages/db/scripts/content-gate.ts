// M6-13 release check: `npm run gate:content` with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
// pointing at production. It prints only the two counts, and exits 1 when the beta does not have enough content.
import { createDbClient } from '../src/index.ts';
import { countContent, gateFailures } from '../src/content-gate.ts';

const counts = await countContent(createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''));
console.log(`boxing skills: ${counts.boxingSkills}, S&C drills and exercises: ${counts.scItems}`);
const failures = gateFailures(counts);
if (failures.length) {
  console.error(`Content gate failed: ${failures.join('; ')}`);
  process.exit(1);
}
console.log('Content gate passed.');
