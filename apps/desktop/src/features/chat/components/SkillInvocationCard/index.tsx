import type { TranscriptItem } from '../../utils/transcript-items';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'skill_invocation' }>;
};

export function SkillInvocationCard({ item }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-l-2 border-primary/40 pl-3 py-1">
      <span className="rounded bg-muted px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        skill
      </span>
      <span className="text-xs font-medium text-foreground">{item.skillName}</span>
      {item.args.map((arg, idx) => (
        <span
          key={idx}
          className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs text-secondary-foreground"
        >
          {arg}
        </span>
      ))}
    </div>
  );
}
