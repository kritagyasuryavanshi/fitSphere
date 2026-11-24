'use client';

import { useSearchParams } from 'next/navigation';

// M4-18: after a report, the page says it arrived (or did not). Wrap in Suspense: it reads the address.
export function ReportNotice() {
  const report = useSearchParams().get('report');
  if (report === 'sent')
    return (
      <p role="status" className="m-0 text-[15px] font-medium text-success">
        Thanks. Your report reached FitSphere, and an admin will look at it.
      </p>
    );
  if (report === 'failed')
    return (
      <p role="alert" className="m-0 text-[15px] font-medium text-danger">
        Your report did not send. Try again.
      </p>
    );
  return null;
}
