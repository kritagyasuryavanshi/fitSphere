import type { ComponentProps } from 'react';

const control =
  'size-[18px] flex-none accent-ink cursor-[inherit] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

export type CheckboxProps = Omit<ComponentProps<'input'>, 'type'> & { label: string };

export function Checkbox({ label, className, ...props }: CheckboxProps) {
  const disabled = props.disabled ? 'text-muted cursor-not-allowed' : 'cursor-pointer';
  return (
    <label className={`flex min-h-11 items-center gap-2.5 text-[15px] ${disabled}`}>
      <input type="checkbox" className={className ? `${control} ${className}` : control} {...props} />
      <span>{label}</span>
    </label>
  );
}

type CardProps = Omit<ComponentProps<'input'>, 'type'> & { label: string; description?: string };
export type RadioCardProps = CardProps;
export type CheckboxCardProps = CardProps;

function ChoiceCard({ type, label, description, className, ...props }: CardProps & { type: 'radio' | 'checkbox' }) {
  // The chosen card has a 2 px border and 1 px less padding, so choosing does not move the layout.
  const state = props.disabled
    ? 'border border-dashed border-line-strong p-4 text-muted cursor-not-allowed'
    : 'border border-line-strong p-4 cursor-pointer has-checked:border-2 has-checked:border-ink has-checked:p-[15px]';
  return (
    <label className={`flex min-h-11 items-start gap-3 ${state}`}>
      <input type={type} className={`${control} mt-0.5${className ? ` ${className}` : ''}`} {...props} />
      <span>
        <span className="block text-[16px] font-medium">{label}</span>
        {description ? <span className="block text-[14px] text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export function RadioCard(props: RadioCardProps) {
  return <ChoiceCard type="radio" {...props} />;
}

/** A card for picking several options, like sports on sign-up step 1. */
export function CheckboxCard(props: CheckboxCardProps) {
  return <ChoiceCard type="checkbox" {...props} />;
}
