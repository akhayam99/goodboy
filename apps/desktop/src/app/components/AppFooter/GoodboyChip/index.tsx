import { useEffect } from 'react';
import { AnchoredPopover, cn, useDropdown } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useThemeStore } from '../../../../shared/lib/theme';
import { collapse } from '../../../../features/onboarding/onboarding-store';
import { useOnboardingProgress } from '../../../../features/onboarding/hooks/useOnboardingProgress';
import { useInstalledVersion } from '../../../../features/changelog/hooks/useInstalledVersion';
import { openReportSheet } from '../../../../features/bug-report/openReportSheet';
import { useHasBugReportDraft } from '../../../../features/settings/hooks/useHasBugReportDraft';
import { UpdateArrivalCard } from '../../../../features/updater/components/UpdateArrivalCard';
import { useRestartWhenIdle } from '../../../../features/updater/hooks/useRestartWhenIdle';
import { openUrl } from '../../../../shared/lib/editor';
import { GoodboyChipLabel, type GoodboyChipState } from './GoodboyChipLabel';
import { GoodboyMenu } from './GoodboyMenu';

type Props = {
  readonly onOpenChangelog: () => void;
  readonly onOpenShortcuts: () => void;
};

export const OPEN_GOODBOY_MENU_EVENT = 'goodboy:open-goodboy-menu';
export const SPONSOR_URL = 'https://github.com/sponsors/akhayam99';

const PANEL_WIDTH = 300;
const PANEL_MAX_HEIGHT = 560;

const TRIGGER_LABEL: Record<GoodboyChipState, string> = {
  update: 'Goodboy: an update is ready',
  setup: 'Goodboy: setup is not finished',
  rest: 'Goodboy beta: version, help and sponsor',
};

export const GoodboyChip = ({ onOpenChangelog, onOpenShortcuts }: Props) => {
  useRestartWhenIdle();
  const progress = useOnboardingProgress();
  const updaterStatus = useAppStore((s) => s.updaterStatus);
  const version = useInstalledVersion();
  const hasDraft = useHasBugReportDraft();
  const dropdown = useDropdown({
    align: 'center',
    width: 'w-75',
    expectedWidth: PANEL_WIDTH,
    expectedHeight: PANEL_MAX_HEIGHT,
    openEvent: OPEN_GOODBOY_MENU_EVENT,
  });
  const { open: isOpen, close, toggle } = dropdown;
  const isQueued = useAppStore((s) => s.updateQueuedUntilIdle);
  const hasUpdate =
    updaterStatus === 'available' ||
    updaterStatus === 'downloading' ||
    updaterStatus === 'ready' ||
    isQueued;
  const isSetupOpen = !progress.finished && progress.hasProjects && !progress.isDone;
  const state: GoodboyChipState = hasUpdate ? 'update' : isSetupOpen ? 'setup' : 'rest';
  const theme = useThemeStore((s) => s.theme);
  const isBrandChip = state === 'rest' && theme === 'light';
  const shouldAutoOpen =
    !progress.finished &&
    progress.wizardDone &&
    progress.completed.has('firstSession') &&
    !progress.collapsed;

  useEffect(() => {
    if (!shouldAutoOpen) {
      return;
    }
    collapse();
    window.dispatchEvent(new CustomEvent(OPEN_GOODBOY_MENU_EVENT));
  }, [shouldAutoOpen]);

  const leaveFor =
    ({ action }: { readonly action: () => void }) =>
    () => {
      close();
      action();
    };

  return (
    <>
      <UpdateArrivalCard onOpenChangelog={leaveFor({ action: onOpenChangelog })} />
      <AnchoredPopover
        dropdown={dropdown}
        role="dialog"
        ariaLabel="Goodboy"
        hasBackdrop
        className="flex flex-col"
        anchorClassName="flex"
        trigger={
          <button
            type="button"
            onClick={toggle}
            aria-label={TRIGGER_LABEL[state]}
            aria-expanded={isOpen}
            data-testid="goodboy-chip"
            className={cn(
              'flex h-6 items-center gap-1.5 rounded-md px-2 text-secondary motion-safe:transition-colors',
              isBrandChip && 'goodboy-brand-chip',
              isOpen ? 'bg-muted' : isBrandChip ? 'bg-background hover:bg-hover' : 'hover:bg-hover',
            )}
          >
            <GoodboyChipLabel state={state} progress={progress} />
          </button>
        }
      >
        <GoodboyMenu
          version={version}
          progress={progress}
          hasUpdate={hasUpdate}
          hasDraft={hasDraft}
          onReport={leaveFor({ action: () => openReportSheet() })}
          onOpenChangelog={leaveFor({ action: onOpenChangelog })}
          onOpenShortcuts={leaveFor({ action: onOpenShortcuts })}
          onSponsor={() => {
            void openUrl(SPONSOR_URL);
          }}
        />
      </AnchoredPopover>
    </>
  );
};
