import { Lightbulb } from 'lucide-react';
import { SectionHeader } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = Record<never, never>;

export const TipsSection = ({}: Props) => {
  const tips: ReadonlyArray<{ readonly title: string; readonly body: string }> = [
    {
      title: 'Triage the board top-down',
      body: 'Start with the attention group, then review, then let the running ones run. The grouping is the to-do list.',
    },
    {
      title: 'Pin one short goal per session',
      body: 'Long open-ended sessions drift. When scope creeps, spin a new one and link via context.',
    },
    {
      title: 'Use cheap models for navigation',
      body: 'The lowest tier can grep, list, and summarize in seconds at a fraction of the price. Swap up only when reasoning gets hard.',
    },
    {
      title: "Queue, don't cancel",
      body: 'If the agent is mid-tool and you have a follow-up, type it: it will queue. Cancelling mid-turn loses the partial work.',
    },
    {
      title: 'Watch spend in the top bar',
      body: 'Workspace spend is always visible up top. No need to open a session to know what it is costing.',
    },
    {
      title: 'Restart on CLI upgrades',
      body: 'When you update an underlying provider CLI, restart Goodboy so it re-detects versions and auth.',
    },
  ];
  return (
    <div className="flex flex-col gap-7">
      <SectionHeader
        size="page"
        icon={<Lightbulb size={ICON_SIZE.control} aria-hidden className="text-warning" />}
        label="Tips"
        hint="Patterns that compound across sessions."
      />
      <div className="grid grid-cols-2 gap-3">
        {tips.map((t, i) => (
          <div
            key={t.title}
            className="flex flex-col gap-1.5 rounded-lg border border-border-soft bg-subtle/40 p-4 motion-safe:transition-colors hover:border-border hover:bg-subtle/60"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-warning/15 font-mono text-2xs font-semibold tabular-nums text-warning">
                {i + 1}
              </span>
              <span className="text-sm font-semibold text-foreground">{t.title}</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{t.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
