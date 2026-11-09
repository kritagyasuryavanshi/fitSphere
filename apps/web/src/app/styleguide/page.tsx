import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button, buttonClass, Checkbox, Input, RadioCard, Tag, type ButtonVariant, type TagVariant } from "@fitsphere/ui";
import { StyleguideDialogs, StyleguideTabs } from "./interactive";

export const metadata: Metadata = {
  title: "Styleguide",
  robots: { index: false },
};

const buttons: ButtonVariant[] = ["ink", "light", "grey", "volt", "danger"];
const tags: TagVariant[] = ["outline", "ink", "volt", "success", "warning", "danger"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-line py-8">
      <h2 className="font-display text-[32px] leading-none font-normal uppercase">{title}</h2>
      {children}
    </section>
  );
}

const row = "flex flex-wrap items-center gap-2";

// A development reference for the design system. Production builds return 404.
export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto w-full max-w-[960px] px-4 py-10">
      <h1 className="font-display text-[64px] leading-[0.9] font-normal uppercase">Styleguide</h1>
      <p className="mt-4 mb-8 text-[16px] text-ink-soft">Fight Camp tokens and base components. Development only.</p>

      <Section title="Buttons">
        <div className={row}>
          {buttons.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </div>
        <div className={row}>
          {buttons.map((variant) => (
            <Button key={variant} variant={variant} size="small">
              {variant} small
            </Button>
          ))}
        </div>
        <div className={`${row} bg-ink p-6`}>
          <Button variant="ghost">ghost</Button>
          <Button variant="ghost" size="small">
            ghost small
          </Button>
        </div>
        <div className={row}>
          <Button disabled>Disabled</Button>
          <a href="#buttons" className={buttonClass({ variant: "volt" })}>
            A link that looks like a button
          </a>
        </div>
      </Section>

      <Section title="Tags">
        <div className={row}>
          {tags.map((variant) => (
            <Tag key={variant} variant={variant}>
              {variant}
            </Tag>
          ))}
        </div>
      </Section>

      <Section title="Inputs">
        <div className="flex max-w-[460px] flex-col gap-6">
          <Input label="Name" autoComplete="off" />
          <Input label="Email" type="email" autoComplete="off" defaultValue="kabir@example" error="Enter a full email address, like kabir@example.com" />
        </div>
      </Section>

      <Section title="Checkboxes">
        <div>
          <Checkbox label="Technical boxing" defaultChecked />
          <Checkbox label="Bag work" />
          <Checkbox label="Not available" disabled />
        </div>
      </Section>

      <Section title="Radio cards">
        <fieldset className="flex max-w-[460px] flex-col gap-2">
          <legend className="mb-2 text-[15px] font-medium">Main goal</legend>
          <RadioCard name="goal" value="muscle" label="Build muscle" description="Hypertrophy" defaultChecked />
          <RadioCard name="goal" value="fat" label="Lose fat" description="Keep your strength" />
          <RadioCard name="goal" value="later" label="Coming later" disabled />
        </fieldset>
      </Section>

      <Section title="Tabs">
        <StyleguideTabs />
      </Section>

      <Section title="Dialogs">
        <StyleguideDialogs />
      </Section>
    </main>
  );
}
