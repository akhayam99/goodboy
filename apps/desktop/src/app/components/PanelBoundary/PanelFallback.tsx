import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button, EmptyState, ScrollFade, type ErrorFallbackRequest } from '@goodboy/ui';
import { CrashReport } from '../../../features/bug-report/components/CrashReport';
import { crashKind, crashPart } from '../../../features/bug-report/crashReport';

type Props = ErrorFallbackRequest & {
  readonly leaveLabel: string;
  readonly onLeave: () => void;
};

export const PanelFallback = ({ error, componentStack, reset, leaveLabel, onLeave }: Props) => {
  const [isReporting, setIsReporting] = useState(false);
  return (
    <ScrollFade className="h-full w-full" viewportClassName="flex min-h-full flex-col gap-4 p-6">
      <div role="alert">
        <EmptyState
          icon={TriangleAlert}
          tone="danger"
          bordered
          title="This page couldn't be drawn"
          description="The rest of the app is still running. Retry draws the page again."
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={reset}>
                Retry
              </Button>
              <Button variant="secondary" onClick={onLeave}>
                {leaveLabel}
              </Button>
              <Button variant="ghost" onClick={() => setIsReporting(true)} disabled={isReporting}>
                Report this
              </Button>
            </div>
          }
        />
      </div>
      {isReporting ? (
        <CrashReport
          heading="Report this crash"
          initialLine={`Crash: ${crashKind({ error })}`}
          errorPart={crashPart({ message: error.message, stack: error.stack, componentStack })}
        />
      ) : null}
    </ScrollFade>
  );
};
