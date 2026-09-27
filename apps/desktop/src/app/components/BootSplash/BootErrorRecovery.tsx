import { Button, cn, tintClasses } from '@goodboy/ui';
import { useCallback } from 'react';
import {
  buildIssueUrl,
  fitsIssueUrl,
  longestFittingPrefix,
  withoutLoneSurrogates,
} from '../../../features/settings/issueUrl';
import { openUrl } from '../../../shared/lib/editor';
import { redactReport } from '../../../shared/utils/redactReport';

const BOOT_ISSUE_TITLE = 'Boot failure';

const ERROR_FIT_NOTICE = '\n[cut here: the rest of the error did not fit the report link]';

type BootBodyParams = {
  readonly category: string;
  readonly error: string;
};

const bootBody = ({ category, error }: BootBodyParams): string =>
  `**category:** ${category}\n\n**error:**\n\`\`\`\n${error}\n\`\`\``;

const bootIssueUrl = ({ category, error }: BootBodyParams): string => {
  const safeCategory = withoutLoneSurrogates({ text: redactReport({ text: category }) });
  const safeError = withoutLoneSurrogates({ text: redactReport({ text: error }) });
  const whole = bootBody({ category: safeCategory, error: safeError });
  if (fitsIssueUrl({ title: BOOT_ISSUE_TITLE, body: whole })) {
    return buildIssueUrl({ title: BOOT_ISSUE_TITLE, body: whole });
  }

  const cutError = longestFittingPrefix({
    text: safeError,
    marker: ERROR_FIT_NOTICE,
    fits: ({ candidate }) =>
      fitsIssueUrl({
        title: BOOT_ISSUE_TITLE,
        body: bootBody({ category: safeCategory, error: candidate }),
      }),
  });
  return buildIssueUrl({
    title: BOOT_ISSUE_TITLE,
    body: bootBody({ category: safeCategory, error: cutError }),
  });
};

type Props = {
  readonly error: string;
  readonly category: string;
  readonly onRetry?: () => void;
};

const sentenceCase = ({ text }: { readonly text: string }): string =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

export const BootErrorRecovery = ({ error, category, onRetry }: Props) => {
  const openIssue = useCallback(() => {
    void openUrl(bootIssueUrl({ category, error }));
  }, [error, category]);

  return (
    <div
      role="alert"
      className={cn(
        'flex w-72 flex-col gap-3 rounded-r-md border-l-2 p-4 text-label',
        tintClasses('danger').border,
      )}
    >
      <div className="flex flex-col gap-1">
        <span className="font-medium text-danger">{`${sentenceCase({ text: category })} failed`}</span>
        <p className="leading-relaxed text-muted-foreground">{error}</p>
      </div>
      <div className="flex items-center gap-2">
        {onRetry !== undefined ? (
          <Button variant="danger" size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={openIssue}>
          Report on GitHub
        </Button>
      </div>
    </div>
  );
};
