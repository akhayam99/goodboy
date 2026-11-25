import { useState } from 'react';
import { Chip } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { openLink } from '../../../open/openLink';
import type { MoveEvidence } from '../../../suggestions/types';

type Props = {
  readonly sessionId: SessionId;
  readonly evidence: ReadonlyArray<MoveEvidence>;
};

type LinesParams = {
  readonly item: MoveEvidence;
};

const evidenceLinesOf = ({ item }: LinesParams): ReadonlyArray<string> => {
  switch (item.kind) {
    case 'log':
      return item.lines;
    case 'files':
      return item.paths;
    case 'command':
      return [item.command];
    case 'quiet':
    case 'link':
      return [];
    default: {
      const exhaustive: never = item;
      return exhaustive;
    }
  }
};

export const MoveEvidenceChips = ({ sessionId, evidence }: Props) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  if (evidence.length === 0) {
    return null;
  }
  const shown = openIndex === null ? null : evidence[openIndex];
  const lines = shown === undefined || shown === null ? [] : evidenceLinesOf({ item: shown });
  return (
    <div data-move-evidence="" className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {evidence.map((item, index) => {
          const isOpen = openIndex === index;
          if (item.kind === 'quiet') {
            return <Chip key={item.label} tone="neutral" kind="reference" label={item.label} />;
          }
          if (item.kind === 'link') {
            return (
              <Chip
                key={item.label}
                as="button"
                tone="neutral"
                kind="reference"
                label={item.label}
                onClick={(event) => openLink({ url: item.url, sessionId, event })}
              />
            );
          }
          return (
            <Chip
              key={item.label}
              as="button"
              tone="neutral"
              kind="reference"
              label={item.label}
              expanded={isOpen}
              onClick={() => setOpenIndex(isOpen ? null : index)}
            />
          );
        })}
      </div>
      {lines.length === 0 ? null : (
        <pre className="min-w-0 rounded-md bg-subtle p-2 font-mono text-meta break-all whitespace-pre-wrap text-muted-foreground">
          {lines.join('\n')}
        </pre>
      )}
    </div>
  );
};
