import { Button } from '@fitsphere/ui';
import type { ComponentProps, ReactNode } from 'react';
import type { Option } from './options';

export function FieldError({ id, children }: { id: string; children?: string }) {
  return children ? (
    <span id={id} className="mt-2 flex items-center gap-1.5 text-[14px] font-medium text-danger">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="flex-none">
        <path d="M12 3l10 18H2z" />
        <path d="M12 10v5M12 18v.5" />
      </svg>
      {children}
    </span>
  ) : null;
}

/** A fieldset with a legend, an optional hint, and an error tied to it. */
export function Group({ name, legend, hint, error, children }: { name: string; legend: ReactNode; hint?: string; error?: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 border-0 p-0" aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="pb-3 text-[18px] font-medium">{legend}</legend>
      {hint ? <p className="m-0 mb-3 text-[14px] text-muted">{hint}</p> : null}
      {children}
      <FieldError id={`${name}-error`}>{error}</FieldError>
    </fieldset>
  );
}

/** Pill-shaped radio buttons for short answers, like days a week. Native radios, so forms and keyboards just work. */
export function Pills({ name, options, value }: { name: string; options: Option[]; value?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label
          key={o.value}
          className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-pill border border-line-strong px-4 text-[15px] font-medium has-checked:border-ink has-checked:bg-ink has-checked:text-paper has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
        >
          <input type="radio" name={name} value={o.value} defaultChecked={o.value === value} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function TextArea({ label, hint, ...props }: ComponentProps<'textarea'> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-2 text-[15px] font-medium">
      <span>
        {label} {hint ? <span className="font-normal text-muted">{hint}</span> : null}
      </span>
      <textarea
        className="box-border w-full border border-line-strong bg-paper px-3.5 py-3 text-[16px] font-normal text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        {...props}
      />
    </label>
  );
}

export function SubmitRow({ note, pending }: { note: string; pending: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line pt-5">
      <span className="text-[14px] text-muted">{note}</span>
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Continue'}
      </Button>
    </div>
  );
}
