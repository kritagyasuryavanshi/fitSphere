import type { ComponentProps } from 'react';

export type ButtonVariant = 'ink' | 'light' | 'grey' | 'volt' | 'ghost' | 'danger';
export type ButtonSize = 'default' | 'small';

const base =
  'inline-flex items-center justify-center gap-2 box-border rounded-pill font-medium cursor-pointer ' +
  'active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed ' +
  'aria-disabled:opacity-40 aria-disabled:cursor-not-allowed ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2';

const colors: Record<ButtonVariant, string> = {
  ink: 'bg-ink text-paper hover:text-paper focus-visible:outline-ink',
  light: 'bg-paper text-ink hover:text-ink border border-line-strong focus-visible:outline-ink',
  grey: 'bg-mist text-ink hover:text-ink focus-visible:outline-ink',
  volt: 'bg-volt text-ink hover:text-ink focus-visible:outline-ink',
  // For dark photos and panels, so the ring is white too.
  ghost: 'bg-transparent text-paper hover:text-paper border-[1.5px] border-paper focus-visible:outline-paper',
  danger: 'bg-danger text-paper hover:text-paper focus-visible:outline-ink',
};

// Each border is offset in the padding, so every variant renders at the same size.
const defaultPadding: Record<ButtonVariant, string> = {
  ink: 'px-7 py-3.5',
  light: 'px-[27px] py-[13px]',
  grey: 'px-7 py-3.5',
  volt: 'px-7 py-3.5',
  ghost: 'px-[26.5px] py-[12.5px]',
  danger: 'px-7 py-3.5',
};

/** The button look as a class string, for links: <Link className={buttonClass({ variant: 'volt' })}>. */
export function buttonClass({ variant = 'ink', size = 'default' }: { variant?: ButtonVariant; size?: ButtonSize } = {}) {
  const sizing = size === 'small' ? 'min-h-11 px-[18px] text-[14px]' : `min-h-12 text-[16px] leading-5 ${defaultPadding[variant]}`;
  return `${base} ${colors[variant]} ${sizing}`;
}

export type ButtonProps = ComponentProps<'button'> & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant, size, type = 'button', className, ...props }: ButtonProps) {
  const classes = buttonClass({ variant, size });
  return <button type={type} className={className ? `${classes} ${className}` : classes} {...props} />;
}
