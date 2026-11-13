'use client';

import { Button, Checkbox, Input } from '@fitsphere/ui';
import Link from 'next/link';
import { useActionState } from 'react';
import { useHydrated } from '@/lib/use-hydrated';
import { FieldError, TextArea } from '../../welcome/fields';
import { applyToCoach, type ApplyValues } from './actions';

type Sport = { id: string; name: string };

export function ApplyForm({ name, sports }: { name: string; sports: Sport[] }) {
  const [state, action, pending] = useActionState(applyToCoach, {});
  const hydrated = useHydrated();
  const errors = state.errors ?? {};
  const values: ApplyValues = state.values ?? { fullName: name, category: sports[0]?.id ?? '', city: '', years: '', workUrl: '', howToday: '', terms: false };

  return (
    <form action={action} noValidate className="grid gap-5 md:grid-cols-2">
      <Input label="Full name" name="full_name" autoComplete="name" maxLength={80} defaultValue={values.fullName} error={errors.fullName} />
      <label className="flex flex-col gap-2 text-[15px] font-medium">
        What you coach
        <select
          name="category"
          defaultValue={values.category}
          className="min-h-12 border border-line-strong bg-paper px-3 text-[16px] font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {sports.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <Input label="City" name="city" autoComplete="address-level2" maxLength={80} defaultValue={values.city} error={errors.city} />
      <div className="flex flex-col gap-1">
        <Input label="Years coaching" name="years" inputMode="numeric" maxLength={2} defaultValue={values.years} error={errors.years} aria-describedby="years-note" />
        <span id="years-note" className="text-[13px] text-muted">
          Shown as self-reported.
        </span>
      </div>
      <div className="md:col-span-2">
        <Input label="Link to your work" name="work_url" type="url" inputMode="url" placeholder="https://youtube.com/@yourchannel" maxLength={300} defaultValue={values.workUrl} error={errors.workUrl} />
      </div>
      <div className="md:col-span-2">
        <TextArea label="How do you send programs to athletes today?" name="how_today" rows={3} maxLength={1000} defaultValue={values.howToday} error={errors.howToday} />
      </div>
      <div className="md:col-span-2">
        <Checkbox name="terms" value="yes" label="I agree to the terms." defaultChecked={values.terms} aria-describedby={errors.terms ? 'terms-error' : undefined} />
        <Link href="/legal/terms" className="text-[14px] underline">
          Read the terms
        </Link>
        <FieldError id="terms-error">{errors.terms}</FieldError>
      </div>
      {errors.form ? (
        <p role="alert" className="m-0 text-[14px] font-medium text-danger md:col-span-2">
          {errors.form}
        </p>
      ) : null}
      <div className="md:col-span-2">
        <Button type="submit" disabled={pending || !hydrated}>
          {pending ? 'Sending…' : 'Send application'}
        </Button>
      </div>
    </form>
  );
}
