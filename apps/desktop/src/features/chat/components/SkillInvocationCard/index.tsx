import { Sparkles } from 'lucide-react';
import type { TranscriptItem } from '../../utils/transcript-items';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TranscriptRowHeader } from '../TranscriptRowHeader';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'skill_invocation' }>;
};

export const SkillInvocationCard = ({ item }: Props) => {
  return (
    <TranscriptDisclosure
      tone="operations"
      open={false}
      header={
        <TranscriptRowHeader
          grouped
          tone="operations"
          icon={<Sparkles size={12} aria-hidden />}
          eyebrow="skill"
          preview={
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-foreground">{item.skillName}</span>
              {item.args.map((arg, index) => (
                <span
                  key={index}
                  className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-xs text-secondary-foreground"
                >
                  {arg}
                </span>
              ))}
            </span>
          }
        />
      }
    />
  );
};
