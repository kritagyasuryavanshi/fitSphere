'use client';

import { Checkbox, CheckboxCard, RadioCard } from '@fitsphere/ui';
import { useActionState } from 'react';
import { Group, Pills, SubmitRow, TextArea } from '../fields';
import { boxingExperience, boxingWants, equipment, trainingDays } from '../options';
import { saveStepTwo, type StepTwoValues } from './actions';

export function StepTwoForm({ boxing, saved }: { boxing: boolean; saved: StepTwoValues }) {
  const [state, action, pending] = useActionState(saveStepTwo, {});
  const errors = state.errors ?? {};
  const values = state.values ?? saved;

  return (
    <form action={action} noValidate className="flex flex-col gap-7">
      <h1 className="sr-only">Your training</h1>
      {boxing ? (
        <>
          <Group name="experience" legend="Your boxing experience" hint="We’ll start you at the right point on the skill path." error={errors.experience}>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2">
              {boxingExperience.map((o) => (
                <RadioCard key={o.value} name="experience" value={o.value} label={o.label} description={o.hint} defaultChecked={values.experience === o.value} />
              ))}
            </div>
          </Group>
          <Group name="wants" legend={<>What do you want? <span className="text-[14px] font-normal text-muted">Pick any</span></>}>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-x-4">
              {boxingWants.map((o) => (
                <Checkbox key={o.value} name="wants" value={o.value} label={o.label} defaultChecked={values.wants.includes(o.value)} />
              ))}
            </div>
          </Group>
        </>
      ) : null}

      <Group name="days" legend="Days a week you can train" error={errors.days}>
        <Pills name="days" options={trainingDays} value={values.days} />
      </Group>

      <Group name="equipment" legend="Equipment you have">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-x-4">
          {equipment.map((o) => (
            <Checkbox key={o.value} name="equipment" value={o.value} label={o.label} defaultChecked={values.equipment.includes(o.value)} />
          ))}
        </div>
      </Group>

      <div className="flex flex-col gap-3">
        <TextArea
          label="Any injuries or limits we should know?"
          hint="Optional"
          name="injuries"
          rows={2}
          maxLength={500}
          placeholder="e.g. old left knee injury, avoid jumping"
          defaultValue={values.injuries}
        />
        {errors.injuries ? <p className="m-0 text-[14px] font-medium text-danger">{errors.injuries}</p> : null}
        <CheckboxCard
          name="ai_consent"
          value="yes"
          label="Use this to personalise AI answers"
          description="It is sent to our AI provider outside India, without your name or contact details. You can turn this off any time."
          defaultChecked={values.aiConsent}
        />
      </div>

      {errors.form ? (
        <p role="alert" className="m-0 text-[14px] font-medium text-danger">
          {errors.form}
        </p>
      ) : null}
      <SubmitRow note="You can change these any time." pending={pending} />
    </form>
  );
}
