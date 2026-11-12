'use client';

import { Input, RadioCard } from '@fitsphere/ui';
import { useActionState } from 'react';
import { FieldError, Group, Pills, SubmitRow, YesNo } from '../fields';
import { gymGoals, gymPlaces, liftingExperience } from '../options';
import { saveStepThree, type StepThreeValues } from './actions';

export function StepThreeForm({ saved }: { saved: StepThreeValues }) {
  const [state, action, pending] = useActionState(saveStepThree, {});
  const errors = state.errors ?? {};
  const values = state.values ?? saved;

  return (
    <form action={action} noValidate className="flex flex-col gap-7">
      <h1 className="sr-only">Your gym goal</h1>
      <Group name="goal" legend="Your gym goal" hint="We suggest programs and rep ranges that fit it. Change it any time." error={errors.goal}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2">
          {gymGoals.map((o) => (
            <RadioCard key={o.value} name="goal" value={o.value} label={o.label} description={o.hint} defaultChecked={values.goal === o.value} />
          ))}
        </div>
      </Group>

      <Group name="place" legend="Where do you train?" error={errors.place}>
        <Pills name="place" options={gymPlaces} value={values.place} />
      </Group>

      <Group name="lifting" legend="Lifting experience" error={errors.lifting}>
        <Pills name="lifting" options={liftingExperience} value={values.lifting} />
      </Group>

      <fieldset className="m-0 border-0 p-0" aria-describedby={errors.body ? 'body-error' : undefined}>
        <legend className="pb-3 text-[18px] font-medium">
          Track body weight? <span className="text-[14px] font-normal text-muted">Optional</span>
        </legend>
        <div className="grid max-w-[420px] grid-cols-2 gap-2">
          <Input label="Weight (kg)" name="weight" inputMode="decimal" placeholder="e.g. 72" defaultValue={values.weight} aria-invalid={errors.body ? true : undefined} />
          <Input label="Height (cm)" name="height" inputMode="numeric" placeholder="e.g. 168" defaultValue={values.height} aria-invalid={errors.body ? true : undefined} />
        </div>
        <FieldError id="body-error">{errors.body}</FieldError>
        <p className="m-0 mt-3 text-[14px] text-muted">Only you and your coach see these. Leave both empty to remove them.</p>
      </fieldset>

      <YesNo
        name="ai_consent"
        legend="Use your weight and height to personalise AI answers?"
        hint="If yes, they are sent to our AI provider outside India, without your name or contact details. You can change this any time."
        value={values.aiConsent}
        error={errors.aiConsent}
      />

      {errors.form ? (
        <p role="alert" className="m-0 text-[14px] font-medium text-danger">
          {errors.form}
        </p>
      ) : null}
      <SubmitRow note="No meal plans in this version." pending={pending} />
    </form>
  );
}
