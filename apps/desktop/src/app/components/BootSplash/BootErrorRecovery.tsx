import { Button, cn, tintClasses } from '@goodboy/ui';
import { useCallback } from 'react';
import { openUrl } from '../../../shared/lib/editor';
import { redactHomePath } from './redactHomePath';

const GITHUB_NEW_ISSUE_URL =
  'https://github.com/akhayam99/goodboy/issues/new?template=bug_report.md&labels=bug%2Cboot&title=Boot+failure';

type Props = {
  readonly error: string;
  readonly category: string;
  readonly onRetry?: () => void;
};

const sentenceCase = ({ text }: { readonly text: string }): string =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

export const BootErrorRecovery = ({ error, category, onRetry }: Props) => {
  const openIssue = useCallback(() => {
    const body = `**category:** ${category}\n\n**error:**\n\`\`\`\n${redactHomePath({ text: error })}\n\`\`\`\n\nBoot timings for this launch are in \`~/.goodboy/boot-breadcrumbs.log\` (phase and timing only, no paths or credentials). Paste the last few lines if you can.`;
    void openUrl(`${GITHUB_NEW_ISSUE_URL}&body=${encodeURIComponent(body)}`);
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
