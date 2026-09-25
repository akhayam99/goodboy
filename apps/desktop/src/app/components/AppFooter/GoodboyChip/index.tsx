import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AnchoredPopover, Divider, IconButton, cn, useDropdown } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { collapse } from '../../../../features/onboarding/onboarding-store';
import { useOnboardingProgress } from '../../../../features/onboarding/hooks/useOnboardingProgress';
import { useInstalledVersion } from '../../../../features/changelog/hooks/useInstalledVersion';
import { ReportIssueForm } from '../../../../features/settings/components/ReportIssueForm';
import { useHasBugReportDraft } from '../../../../features/settings/hooks/useHasBugReportDraft';
import { openUrl } from '../../../../shared/lib/editor';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { GoodboyChipLabel, type GoodboyChipState } from './GoodboyChipLabel';
import { GoodboyMenu } from './GoodboyMenu';

type Props = {
  readonly onOpenChangelog: () => void;
  readonly onOpenShortcuts: () => void;
};

type View = 'menu' | 'report';

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
  const progress = useOnboardingProgress();
  const updaterStatus = useAppStore((s) => s.updaterStatus);
  const version = useInstalledVersion();
  const hasDraft = useHasBugReportDraft();
  const [view, setView] = useState<View>('menu');
  const dropdown = useDropdown({
    align: 'center',
    width: 'w-75',
    expectedWidth: PANEL_WIDTH,
    expectedHeight: PANEL_MAX_HEIGHT,
    openEvent: OPEN_GOODBOY_MENU_EVENT,
  });
  const { open: isOpen, close, toggle } = dropdown;
  const hasUpdate = updaterStatus === 'available' || updaterStatus === 'downloading';
  const isSetupOpen = !progress.finished && progress.hasProjects && !progress.isDone;
  const state: GoodboyChipState = hasUpdate ? 'update' : isSetupOpen ? 'setup' : 'rest';
  const shouldAutoOpen = !progress.finished && progress.hasProjects && !progress.collapsed;

  useEffect(() => {
    if (!shouldAutoOpen) {
      return;
    }
    collapse();
    window.dispatchEvent(new CustomEvent(OPEN_GOODBOY_MENU_EVENT));
  }, [shouldAutoOpen]);

  useEffect(() => {
    if (isOpen) {
      return;
    }
    setView('menu');
  }, [isOpen]);

  const leaveFor =
    ({ action }: { readonly action: () => void }) =>
    () => {
      close();
      action();
    };

  return (
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
            'flex h-6 items-center gap-1.5 rounded-md px-2 text-2xs motion-safe:transition-colors',
            isOpen ? 'bg-muted' : 'hover:bg-hover',
          )}
        >
          <GoodboyChipLabel state={state} progress={progress} />
        </button>
      }
    >
      {view === 'report' ? (
        <>
          <header className="flex items-center gap-1.5 px-2 py-1.5">
            <IconButton
              variant="ghost"
              icon={ArrowLeft}
              iconSize={ICON_SIZE.row}
              label="Back"
              onClick={() => setView('menu')}
            />
            <span className="text-xs font-semibold text-foreground">Report a bug</span>
            {hasDraft ? (
              <span className="ml-auto pr-1 text-2xs text-faint-foreground">Draft saved</span>
            ) : null}
          </header>
          <Divider />
          <ReportIssueForm onOpenFullForm={close} />
        </>
      ) : (
        <GoodboyMenu
          version={version}
          progress={progress}
          hasUpdate={hasUpdate}
          hasDraft={hasDraft}
          onReport={() => setView('report')}
          onOpenChangelog={leaveFor({ action: onOpenChangelog })}
          onOpenShortcuts={leaveFor({ action: onOpenShortcuts })}
          onSponsor={() => {
            void openUrl(SPONSOR_URL);
          }}
        />
      )}
    </AnchoredPopover>
  );
};
