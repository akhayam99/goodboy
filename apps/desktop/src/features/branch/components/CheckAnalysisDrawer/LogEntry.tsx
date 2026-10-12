import { useState } from 'react';
import { Disclosure, ScrollFade } from '@goodboy/ui';
import type { FailedLog } from '../../checks/failedLogsOf';

type Props = {
  readonly log: FailedLog;
};

export const LogEntry = ({ log }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  if (log.text === null) {
    return <p className="text-body text-muted-foreground">{log.name}: not readable here.</p>;
  }
  return (
    <Disclosure
      label={
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-row text-foreground">{log.name}</span>
          <span className="shrink-0 text-meta text-muted-foreground">
            {log.lineCount === 1 ? '1 line' : `${log.lineCount} lines`}
          </span>
        </span>
      }
      isOpen={isOpen}
      onToggle={() => setIsOpen((wasOpen) => !wasOpen)}
    >
      <ScrollFade className="max-h-64" viewportClassName="min-w-0">
        <pre
          aria-label={`Log of ${log.name}`}
          className="whitespace-pre-wrap break-all rounded-md bg-fill p-2 text-code text-muted-foreground"
        >
          {log.text}
        </pre>
      </ScrollFade>
    </Disclosure>
  );
};
