import { Button, CommandPreview, CopyButton, Notice } from '@goodboy/ui';

type Props = {
  readonly repoName: string;
  readonly isTokenBound: boolean;
  readonly isChecking: boolean;
  readonly error: string | null;
  readonly onOpenSettings: () => void;
  readonly onCheckAgain: () => void;
};

const REFRESH_COMMAND = 'gh auth refresh -s repo';

export const ChecksDeniedNotice = ({
  repoName,
  isTokenBound,
  isChecking,
  error,
  onOpenSettings,
  onCheckAgain,
}: Props) => (
  <Notice
    tone="warning"
    placement="inline"
    title={`Goodboy can't read checks for ${repoName}`}
    body="The GitHub access Goodboy uses can't read checks."
    detail={error}
    actions={
      <>
        {isTokenBound ? (
          <Button variant="secondary" size="sm" onClick={onOpenSettings}>
            Open GitHub settings
          </Button>
        ) : null}
        <Button variant="secondary" size="sm" isBusy={isChecking} onClick={onCheckAgain}>
          Check again
        </Button>
      </>
    }
  >
    {isTokenBound ? (
      <p className="text-label text-muted-foreground">
        Give the token read access to checks and commit statuses.
      </p>
    ) : (
      <div className="flex min-w-0 flex-col items-start gap-2">
        <p className="text-label text-muted-foreground">
          Run this in a terminal, then check again.
        </p>
        <div className="flex min-w-0 items-center gap-1">
          <CommandPreview command={REFRESH_COMMAND} />
          <CopyButton presentation="icon" value={REFRESH_COMMAND} label="Copy command" />
        </div>
      </div>
    )}
  </Notice>
);
