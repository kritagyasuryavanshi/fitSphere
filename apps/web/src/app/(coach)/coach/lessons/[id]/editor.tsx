'use client';

import { Button, Input } from '@fitsphere/ui';
import { useActionState, useState } from 'react';
import { readiness, youtubeId } from '@/lib/lesson-draft';
import { useHydrated } from '@/lib/use-hydrated';
import { FieldError, TextArea } from '../../../../welcome/fields';
import { saveLesson } from '../actions';

export type Discipline = { id: string; name: string; categoryId: string; categoryName: string; usesSupports: boolean; usesMuscles: boolean };
export type Draft = {
  id: string | null;
  disciplineId: string;
  kind: string;
  title: string;
  summary: string;
  level: string;
  durationMin: number | null;
  equipment: string[];
  supports: string[];
  videoId: string | null;
  mistakes: string;
  safety: string;
  steps: string[];
  muscles: string[];
  learnFirst: string[];
};
type Option = { id: string; label: string; categoryId?: string };

const label = (s: string) => s.replace(/_/g, ' ');

export function LessonEditor({ draft, disciplines, muscles, lessons }: { draft: Draft; disciplines: Discipline[]; muscles: Option[]; lessons: Option[] }) {
  const [state, action, pending] = useActionState(saveLesson, {});
  const hydrated = useHydrated();
  const [disciplineId, setDisciplineId] = useState(draft.disciplineId || disciplines[0]?.id || '');
  const [video, setVideo] = useState(draft.videoId ? `https://youtu.be/${draft.videoId}` : '');
  const [steps, setSteps] = useState(draft.steps.length >= 3 ? draft.steps : [...draft.steps, '', '', ''].slice(0, 3));
  const [mistakes, setMistakes] = useState(draft.mistakes);
  const [safety, setSafety] = useState(draft.safety);
  const [supports, setSupports] = useState(draft.supports.map(label).join(', '));
  const [chosenMuscles, setChosenMuscles] = useState(draft.muscles);

  const discipline = disciplines.find((d) => d.id === disciplineId);
  const videoId = video.trim() ? youtubeId(video) : null;
  const check = readiness({
    videoId,
    steps,
    mistakes,
    safety,
    needsSupports: !!discipline?.usesSupports,
    supports: supports.split(',').filter((s) => s.trim()),
    needsMuscles: !!discipline?.usesMuscles,
    muscles: chosenMuscles,
  });
  const fieldError = (name: string) => (state.field === name ? state.error : undefined);
  const categories = [...new Map(disciplines.map((d) => [d.categoryId, d.categoryName]))];

  return (
    <form action={action} noValidate className="grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <input type="hidden" name="id" value={draft.id ?? ''} />
      <div className="flex flex-col gap-6">
        <Input label="Lesson title" name="title" defaultValue={draft.title} maxLength={120} error={fieldError('title')} />

        <label className="flex flex-col gap-2 text-[15px] font-medium">
          Sport and discipline
          <select
            name="discipline"
            value={disciplineId}
            onChange={(e) => setDisciplineId(e.target.value)}
            className="min-h-12 border border-line-strong bg-paper px-3 text-[16px] font-normal"
          >
            {categories.map(([id, name]) => (
              <optgroup key={id} label={name}>
                {disciplines
                  .filter((d) => d.categoryId === id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {name} · {d.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-2 text-[15px] font-medium">
            Type
            <select name="kind" defaultValue={draft.kind} className="min-h-12 border border-line-strong bg-paper px-3 text-[16px] font-normal">
              <option value="skill">Skill lesson</option>
              <option value="drill">Drill</option>
              <option value="exercise">Exercise</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-[15px] font-medium">
            Level
            <select name="level" defaultValue={draft.level} className="min-h-12 border border-line-strong bg-paper px-3 text-[16px] font-normal">
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <Input label="Minutes" name="duration" type="number" min={1} max={240} defaultValue={draft.durationMin ?? ''} />
        </div>

        <div className="flex flex-col gap-1">
          <Input label="YouTube video link" name="video" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://youtu.be/…" error={fieldError('video')} />
          {video.trim() && !fieldError('video') ? (
            videoId ? (
              <span className="text-[14px] font-medium text-success">Video found</span>
            ) : (
              <FieldError id="video-hint">This is not a YouTube link. Paste the link from the Share button.</FieldError>
            )
          ) : null}
        </div>

        <TextArea label="Summary" name="summary" defaultValue={draft.summary} rows={2} maxLength={500} />

        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="pb-2 text-[15px] font-medium">Steps</legend>
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-3 flex size-7 flex-none items-center justify-center rounded-full bg-ink text-[13px] text-paper">
                {i + 1}
              </span>
              <label className="flex-1">
                <span className="sr-only">Step {i + 1}</span>
                <textarea
                  name="step"
                  value={s}
                  rows={2}
                  maxLength={500}
                  onChange={(e) => setSteps(steps.map((x, j) => (j === i ? e.target.value : x)))}
                  className="box-border w-full border border-line-strong bg-paper px-3.5 py-3 text-[16px]"
                />
              </label>
              {steps.length > 1 ? (
                <button type="button" onClick={() => setSteps(steps.filter((_, j) => j !== i))} className="mt-2 min-h-11 px-2 text-[14px] underline">
                  Remove<span className="sr-only"> step {i + 1}</span>
                </button>
              ) : null}
            </div>
          ))}
          {steps.length < 30 ? (
            <button type="button" onClick={() => setSteps([...steps, ''])} className="min-h-11 self-start text-[15px] font-medium underline underline-offset-4">
              Add step
            </button>
          ) : null}
        </fieldset>

        <TextArea label="Common mistakes" name="mistakes" value={mistakes} onChange={(e) => setMistakes(e.target.value)} rows={3} maxLength={1000} />
        <TextArea
          label="Safety"
          name="safety"
          value={safety}
          onChange={(e) => setSafety(e.target.value)}
          rows={3}
          maxLength={1000}
          error={fieldError('safety') ?? (!safety.trim() && mistakes.trim() ? 'Add at least one safety point before you submit.' : undefined)}
        />
        <Input label="Equipment" name="equipment" defaultValue={draft.equipment.map(label).join(', ')} placeholder="Heavy bag, gloves" error={fieldError('equipment')} />

        {discipline?.usesSupports ? (
          <Input label="The boxing skill it builds" name="supports" value={supports} onChange={(e) => setSupports(e.target.value)} placeholder="Punching power, round endurance" />
        ) : (
          <input type="hidden" name="supports" value={supports} />
        )}

        {discipline?.usesMuscles ? (
          <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
            <legend className="pb-2 text-[15px] font-medium">Muscles it works (main one first)</legend>
            <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
              {muscles.map((m) => (
                <label key={m.id} className="flex min-h-11 items-center gap-2.5 text-[15px]">
                  <input
                    type="checkbox"
                    name="muscle"
                    value={m.id}
                    checked={chosenMuscles.includes(m.id)}
                    onChange={(e) => setChosenMuscles(e.target.checked ? [...chosenMuscles, m.id] : chosenMuscles.filter((x) => x !== m.id))}
                    className="size-[18px] accent-ink"
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <details className="border-y border-line py-3" open={draft.learnFirst.length > 0}>
          <summary className="flex min-h-11 cursor-pointer items-center text-[15px] font-medium">Learn first</summary>
          <div className="flex flex-col pt-2">
            {lessons
              .filter((l) => l.categoryId === discipline?.categoryId && l.id !== draft.id)
              .map((l) => (
                <label key={l.id} className="flex min-h-11 items-center gap-2.5 text-[15px]">
                  <input type="checkbox" name="learn_first" value={l.id} defaultChecked={draft.learnFirst.includes(l.id)} className="size-[18px] accent-ink" />
                  {l.label}
                </label>
              ))}
          </div>
        </details>
      </div>

      <aside aria-labelledby="ready" className="flex flex-col gap-4 self-start border border-line-strong p-5 md:sticky md:top-6">
        <h2 id="ready" className="m-0 text-[20px] font-medium">
          Ready for review?
        </h2>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {check.checks.map((c) => (
            <li key={c.label} className={`flex items-center gap-2 text-[15px] ${c.done ? '' : 'text-muted'}`}>
              <span aria-hidden="true">{c.done ? '✓' : '○'}</span>
              {c.label}
              <span className="sr-only">{c.done ? ', done' : ', not done'}</span>
            </li>
          ))}
        </ul>
        {state.error && !['title', 'video', 'safety', 'equipment'].includes(state.field ?? '') ? (
          <p role="alert" className="m-0 text-[14px] font-medium text-danger">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" name="intent" value="submit" disabled={!hydrated || pending || !check.ready}>
          Submit for review
        </Button>
        <Button type="submit" name="intent" value="save" variant="light" disabled={!hydrated || pending}>
          Save draft
        </Button>
        <p className="m-0 text-[14px] text-muted">Another reviewer checks it. You cannot approve your own lesson.</p>
      </aside>
    </form>
  );
}
