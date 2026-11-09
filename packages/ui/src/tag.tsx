import type { ComponentProps } from 'react';

export type TagVariant = 'outline' | 'ink' | 'volt' | 'success' | 'warning' | 'danger';

const variants: Record<TagVariant, string> = {
  outline: 'border border-line-strong text-ink font-medium px-3 py-[5px]',
  ink: 'bg-ink text-paper font-semibold px-3 py-1.5',
  volt: 'bg-volt text-ink font-semibold px-3 py-1.5',
  success: 'bg-success-soft text-success font-semibold px-3 py-1.5',
  warning: 'bg-warning-soft text-warning font-semibold px-3 py-1.5',
  danger: 'bg-danger-soft text-danger font-semibold px-3 py-1.5',
};

export type TagProps = ComponentProps<'span'> & { variant?: TagVariant };

export function Tag({ variant = 'outline', className, ...props }: TagProps) {
  const classes = `inline-flex items-center rounded-pill text-[12px] whitespace-nowrap ${variants[variant]}`;
  return <span className={className ? `${classes} ${className}` : classes} {...props} />;
}
