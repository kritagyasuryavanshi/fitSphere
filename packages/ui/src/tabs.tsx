'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export type Tab = { id: string; label: string; content: ReactNode };

export type TabsProps = {
  /** Names the group for screen readers, such as "Weeks". */
  label: string;
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (id: string) => void;
};

export function Tabs({ label, tabs, defaultTab, onChange }: TabsProps) {
  const baseId = useId();
  const [current, setCurrent] = useState(defaultTab ?? tabs[0]?.id);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const active = tabs.find((tab) => tab.id === current);

  function select(id: string) {
    setCurrent(id);
    onChange?.(id);
  }

  function onKeyDown(event: KeyboardEvent, index: number) {
    const last = tabs.length - 1;
    const targets: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const target = tabs[targets[event.key] ?? -1];
    if (!target) return;
    event.preventDefault();
    select(target.id);
    buttons.current.get(target.id)?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex overflow-x-auto border-b border-line-strong">
        {tabs.map((tab, index) => {
          const isCurrent = tab.id === current;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) buttons.current.set(tab.id, el);
                else buttons.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={isCurrent}
              aria-controls={isCurrent ? `${baseId}-panel` : undefined}
              tabIndex={isCurrent ? 0 : -1}
              onClick={() => select(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={
                'min-h-11 flex-none cursor-pointer border-b-[3px] bg-transparent px-[22px] py-3.5 text-[15px] ' +
                'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink ' +
                (isCurrent ? 'border-ink font-semibold text-ink' : 'border-transparent font-medium text-muted')
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {active ? (
        <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${active.id}`} tabIndex={0}>
          {active.content}
        </div>
      ) : null}
    </div>
  );
}
