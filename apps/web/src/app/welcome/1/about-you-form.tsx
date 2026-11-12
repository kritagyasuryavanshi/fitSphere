'use client';

import { Button, CheckboxCard, Input } from '@fitsphere/ui';
import { useActionState } from 'react';
import { saveAboutYou, type AboutYouValues } from './actions';

type Sport = { id: string; name: string; tagline: string; is_live: boolean };

function FieldError({ id, children }: { id: string; children?: string }) {
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

export function AboutYouForm({ sports, saved }: { sports: Sport[]; saved: AboutYouValues }) {
  const [state, action, pending] = useActionState(saveAboutYou, {});
  const errors = state.errors ?? {};
  const values = state.values ?? saved;

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px] md:leading-[0.9]">About you</h1>
      <Input label="First name" name="name" autoComplete="given-name" defaultValue={values.name} error={errors.name} maxLength={80} />

      <fieldset className="m-0 border-0 p-0" aria-describedby={errors.dob ? 'dob-error' : undefined}>
        <legend className="pb-2 text-[15px] font-medium">Date of birth</legend>
        <p className="m-0 mb-3 text-[14px] text-muted">FitSphere is for adults. We check this once.</p>
        <div className="grid max-w-[420px] grid-cols-3 gap-2">
          <Input label="Day" name="day" inputMode="numeric" autoComplete="bday-day" maxLength={2} defaultValue={values.day} aria-invalid={errors.dob ? true : undefined} />
          <Input label="Month" name="month" inputMode="numeric" autoComplete="bday-month" maxLength={2} defaultValue={values.month} aria-invalid={errors.dob ? true : undefined} />
          <Input label="Year" name="year" inputMode="numeric" autoComplete="bday-year" maxLength={4} defaultValue={values.year} aria-invalid={errors.dob ? true : undefined} />
        </div>
        <FieldError id="dob-error">{errors.dob}</FieldError>
      </fieldset>

      <fieldset className="m-0 border-0 p-0" aria-describedby={errors.sports ? 'sports-error' : undefined}>
        <legend className="pb-3 text-[18px] font-medium">What do you want to train?</legend>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-2">
          {sports.map((sport) => (
            <CheckboxCard
              key={sport.id}
              name="sport"
              value={sport.id}
              label={sport.name}
              description={sport.tagline}
              disabled={!sport.is_live}
              defaultChecked={sport.is_live && values.sports.includes(sport.id)}
            />
          ))}
        </div>
        <FieldError id="sports-error">{errors.sports}</FieldError>
      </fieldset>

      {errors.form ? <p role="alert" className="m-0 text-[14px] font-medium text-danger">{errors.form}</p> : null}
      <div className="flex items-center justify-between gap-4 border-t border-line pt-5">
        <span className="text-[14px] text-muted">Adults 18+ only.</span>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Continue'}
        </Button>
      </div>
    </form>
  );
}
