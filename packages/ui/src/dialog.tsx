'use client';

import { useEffect, useId, useRef, type ReactNode, type SyntheticEvent } from 'react';

export type DialogProps = {
  open: boolean;
  /** Called on Escape. The parent sets open to false. */
  onClose: () => void;
  title: string;
  description?: ReactNode;
  /** Buttons, in the order the mockups show them. */
  actions?: ReactNode;
  /** A destructive confirm: adds the warning icon and does not put focus on the first button. */
  alert?: boolean;
  children?: ReactNode;
};

export function Dialog({ open, onClose, title, description, actions, alert = false, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // The browser focuses the first control. In a confirm that is the destructive one, where a stray Enter would fire it.
      if (alert) el.focus();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open, alert]);

  function onCancel(event: SyntheticEvent) {
    event.preventDefault();
    onClose();
  }

  return (
    <dialog
      ref={ref}
      role={alert ? 'alertdialog' : 'dialog'}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      tabIndex={-1}
      onCancel={onCancel}
      // Browsers can close on a repeated Escape without a cancellable event, so keep the parent in step.
      onClose={() => {
        if (open) onClose();
      }}
      className="m-auto box-border w-[calc(100%-32px)] max-w-[520px] bg-paper text-ink outline-none backdrop:bg-ink/60"
    >
      <div className="flex flex-col gap-4 p-8">
        {alert ? (
          <span className="text-danger">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 3l10 18H2z" />
              <path d="M12 10v5M12 18v.5" />
            </svg>
          </span>
        ) : null}
        <h2 id={titleId} className="font-display text-[48px] leading-[0.9] font-normal wrap-break-word uppercase">
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="max-w-[62ch] text-[16px] leading-[1.6] text-ink-soft">
            {description}
          </p>
        ) : null}
        {children}
        {actions ? <div className="mt-2 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </dialog>
  );
}
