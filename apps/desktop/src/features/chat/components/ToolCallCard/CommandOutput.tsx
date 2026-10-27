import { useState } from 'react';
import { Button, EmptyLine } from '@goodboy/ui';
import { OUTPUT_TAIL_LINES, outputTail } from '../../utils/outputTail';
import { Section } from './Section';

type Props = {
  readonly output: string;
  readonly exitCode: number | null;
};

export const CommandOutput = ({ output, exitCode }: Props) => {
  const [isAll, setIsAll] = useState(false);
  const tail = outputTail({
    text: output,
    maxLines: isAll ? Number.MAX_SAFE_INTEGER : OUTPUT_TAIL_LINES,
  });
  const label = exitCode === null ? 'output' : `output, exit ${exitCode}`;

  return (
    <Section label={label}>
      {output === '' ? (
        <EmptyLine>No output</EmptyLine>
      ) : (
        <pre
          data-testid="tool-output"
          className="min-w-0 whitespace-pre-wrap break-words rounded-md bg-muted px-3 py-2 text-code text-muted-foreground"
        >
          {tail.text}
        </pre>
      )}
      {tail.hiddenLines === 0 && !isAll ? null : (
        <div className="flex">
          <Button variant="ghost" size="sm" onClick={() => setIsAll((wasAll) => !wasAll)}>
            {isAll
              ? `Show the last ${OUTPUT_TAIL_LINES} lines`
              : `Show all ${tail.totalLines} lines`}
          </Button>
        </div>
      )}
    </Section>
  );
};
