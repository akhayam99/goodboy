import { cn as tokenCn, tintClasses as tokenTintClasses } from '@goodboy/ui';
import { useState } from 'react';
import { X } from 'lucide-react';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { useInstalledVersion } from '../../hooks/useInstalledVersion';
import { useUnseenRelease } from '../../hooks/useUnseenRelease';
import { Tooltip } from '@goodboy/ui';

type Props = {
  readonly onOpenChangelog: () => void;
};

export const ReleaseToast = ({ onOpenChangelog }: Props) => {
  const [dismissed, setDismissed] = useState(false);
  const seenVersion = useAppStore((s) => s.changelogSeenVersion);
  const installedVersion = useInstalledVersion();
  const hasUnseenRelease = useUnseenRelease();

  if (dismissed || seenVersion == null || !hasUnseenRelease) {
    return null;
  }

  return (
    <div
      role="status"
      data-testid="release-toast"
      className={tokenCn(
        'fixed bottom-12 right-3 z-toast flex max-w-96 items-start gap-3 rounded-lg border',
        tokenTintClasses('primary').borderSoft,
        'bg-elevated px-3 py-3 shadow-lg',
      )}
    >
      <CONCEPT_ICONS.changelog
        size={ICON_SIZE.control}
        aria-hidden
        className="mt-px shrink-0 text-primary"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-foreground">
          {installedVersion != null ? `Updated to ${installedVersion}` : 'Update installed'}
        </p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          The release notes list what changed.
        </p>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            onOpenChangelog();
          }}
          className="mt-1.5 rounded px-1.5 py-0.5 text-2xs font-medium text-foreground ring-1 ring-inset ring-foreground/20 hover:bg-hover hover:text-foreground"
        >
          Read the changelog
        </button>
      </div>
      <Tooltip content="Dismiss release notice">
        <button
          type="button"
          aria-label="Dismiss release notice"
          onClick={() => setDismissed(true)}
          className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-faint-foreground hover:bg-hover hover:text-foreground"
        >
          <X size={ICON_SIZE.row} aria-hidden />
        </button>
      </Tooltip>
    </div>
  );
};
