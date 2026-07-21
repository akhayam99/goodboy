import type { TranscriptItem } from '../../utils/transcript-items';
import { TranscriptShell } from '../TranscriptShell';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'skill_invocation' }>;
};

export const SkillInvocationCard = ({ item }: Props) => {
  return (
    <TranscriptShell
      tone="primary"
      variant="leftBorder"
      className="flex flex-wrap items-center gap-2"
    >
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
    </TranscriptShell>
  );
};
