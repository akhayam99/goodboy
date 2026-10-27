import { Button, Notice } from '@goodboy/ui';
import { useMemo, useState, type ReactNode } from 'react';
import { CrashReport } from '../../../features/bug-report/components/CrashReport';
import { crashPart } from '../../../features/bug-report/crashReport';
import { NAMES } from '../../../shared/utils/names';

type Props = {
  readonly error: string;
  readonly category: string;
  readonly onRetry?: () => void;
  readonly title?: string;
  readonly leading?: ReactNode;
  readonly notes?: ReactNode;
  readonly widthClass?: string;
};

const sentenceCase = ({ text }: { readonly text: string }): string =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

export const BootErrorRecovery = ({
  error,
  category,
  onRetry,
  title,
  leading,
  notes,
  widthClass = 'w-72',
}: Props) => {
  const [isReporting, setIsReporting] = useState(false);
  const errorPart = useMemo(
    () => crashPart({ message: `${category} failed: ${error}`, stack: null, componentStack: null }),
    [category, error],
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={widthClass}>
        <Notice
          tone="danger"
          placement="inline"
          role="alert"
          title={title ?? `${sentenceCase({ text: category })} failed`}
          body={error}
          actions={
            <>
              {leading}
              {onRetry !== undefined ? (
                <Button variant="secondary" size="sm" onClick={onRetry}>
                  {NAMES.retry}
                </Button>
              ) : null}
              {isReporting ? null : (
                <Button variant="ghost" size="sm" onClick={() => setIsReporting(true)}>
                  Report this
                </Button>
              )}
            </>
          }
        >
          {notes}
        </Notice>
      </div>
      {isReporting ? (
        <div className="w-full max-w-140">
          <CrashReport
            heading="Report this startup error"
            initialLine={`Startup failed: ${category}`}
            errorPart={errorPart}
          />
        </div>
      ) : null}
    </div>
  );
};
