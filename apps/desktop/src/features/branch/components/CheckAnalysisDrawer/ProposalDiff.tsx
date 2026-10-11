import { ScrollFade, cn } from '@goodboy/ui';

import { LINE_FILL } from '../../../diff/lib/lineTone';

type Props = {
  readonly text: string;
};

export const ProposalDiff = ({ text }: Props) => {
  const lines = text.split('\n');
  const rawFile = lines.find((line) => line.startsWith('+++ '))?.slice(4) ?? 'Proposed change';
  const file = rawFile.startsWith('b/') ? rawFile.slice(2) : rawFile;
  const additions = lines.filter((line) => line.startsWith('+') && !line.startsWith('+++ ')).length;
  const deletions = lines.filter((line) => line.startsWith('-') && !line.startsWith('--- ')).length;
  return (
    <div
      role="region"
      aria-label={`Proposed diff for ${file}`}
      className="flex min-w-0 flex-col gap-2 rounded-md bg-fill p-2"
    >
      <div className="flex items-center gap-2 text-label">
        <span className="min-w-0 flex-1 truncate">{file}</span>
        <span className="text-success tabular-nums">+{additions}</span>
        <span className="text-danger tabular-nums">−{deletions}</span>
      </div>
      <ScrollFade className="max-h-64" viewportClassName="min-w-0">
        <pre className="text-code">
          {lines.map((line, index) => (
            <div
              key={index}
              className={cn(
                line.startsWith('+') && LINE_FILL.add + ' text-success',
                line.startsWith('-') && LINE_FILL.del + ' text-danger',
              )}
            >
              {line === '' ? ' ' : line}
            </div>
          ))}
        </pre>
      </ScrollFade>
    </div>
  );
};
