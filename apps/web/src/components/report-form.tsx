import { reportContent } from '@/app/(account)/report/actions';

const REASONS: [string, string][] = [
  ['harassment', 'Harassment or abuse'],
  ['spam', 'Spam'],
  ['unsafe_advice', 'Unsafe training advice'],
  ['fake', 'Fake or misleading'],
  ['off_platform_payment', 'Asked to pay outside FitSphere'],
  ['other', 'Something else'],
];

// M4-18: a small "Report" disclosure that works without JavaScript. Only for signed-in people.
export function ReportForm({ kind, target, back, label }: { kind: 'review' | 'message' | 'coach'; target: string; back: string; label: string }) {
  const id = `report-${kind}-${target}`;
  return (
    <details className="text-[14px]">
      <summary className="cursor-pointer text-muted underline underline-offset-4">Report<span className="sr-only"> {label}</span></summary>
      <form action={reportContent} className="mt-2 flex flex-col gap-2 border border-line p-3">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="target" value={target} />
        <input type="hidden" name="back" value={back} />
        <label htmlFor={`${id}-reason`} className="font-medium">
          Why are you reporting this?
        </label>
        <select id={`${id}-reason`} name="reason" required className="min-h-11 border border-line-strong bg-paper px-2 text-[15px]">
          {REASONS.map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-note`} className="font-medium">
          Anything to add (optional)
        </label>
        <textarea id={`${id}-note`} name="note" maxLength={500} rows={2} className="border border-line-strong p-2 text-[15px]" />
        <button type="submit" className="self-start font-medium underline underline-offset-4">
          Send report
        </button>
      </form>
    </details>
  );
}
