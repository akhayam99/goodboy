import { ExternalLink } from 'lucide-react';
import { Button, CopyButton, Notice } from '@goodboy/ui';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import { currentPlatform } from '../../../shared/platform';

type Props = {
  readonly isChecking: boolean;
  readonly onCheckAgain: () => void;
};

const INSTALL_COMMAND = 'brew install gh';
const INSTALL_URL = 'https://cli.github.com';

export const GhInstallHelp = ({ isChecking, onCheckAgain }: Props) => (
  <Notice
    tone="warning"
    placement="inline"
    title="GitHub's command line tool isn't installed"
    body="Install it, then check again. Or use an existing repository."
    actions={
      <Button variant="secondary" size="sm" disabled={isChecking} onClick={onCheckAgain}>
        Check again
      </Button>
    }
  >
    {currentPlatform() === 'darwin' ? (
      <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-border-soft bg-background py-1 pl-3 pr-1">
        <code className="min-w-0 truncate text-code text-foreground">{INSTALL_COMMAND}</code>
        <CopyButton value={INSTALL_COMMAND} />
      </div>
    ) : (
      <a
        href={INSTALL_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-label text-foreground underline underline-offset-2"
      >
        Install gh <ExternalLink size={ICON_SIZE.row} aria-hidden />
      </a>
    )}
  </Notice>
);
