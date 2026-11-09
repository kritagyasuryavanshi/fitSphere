import { useId, type ComponentProps } from 'react';

export type InputProps = ComponentProps<'input'> & {
  label: string;
  /** Shown under the field, in place of a browser message. */
  error?: string;
};

export function Input({ label, error, id, className, 'aria-describedby': describedBy, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const description = [describedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined;
  const border = error ? 'border-2 border-danger' : 'border border-line-strong';

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-[15px] font-medium">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={description}
        className={
          `box-border min-h-12 w-full bg-paper px-3.5 py-3 text-[16px] font-normal text-ink ` +
          `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ` +
          `disabled:opacity-40 disabled:cursor-not-allowed ${border}${className ? ` ${className}` : ''}`
        }
        {...props}
      />
      {error ? (
        <span id={errorId} className="flex items-center gap-1.5 text-[14px] font-medium text-danger">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="flex-none">
            <path d="M12 3l10 18H2z" />
            <path d="M12 10v5M12 18v.5" />
          </svg>
          {error}
        </span>
      ) : null}
    </div>
  );
}
