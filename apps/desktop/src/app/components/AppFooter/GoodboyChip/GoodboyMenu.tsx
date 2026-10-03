import { ExternalLink, Heart } from 'lucide-react';
import { Button, Divider, Eyebrow, DogMascot, XIcon } from '@goodboy/ui';
import { finish } from '../../../../features/onboarding/onboarding-store';
import type { OnboardingProgress } from '../../../../features/onboarding/hooks/useOnboardingProgress';
import { ChecklistBody } from '../../../../features/onboarding/SetupChecklist/ChecklistBody';
import { CompletedBody } from '../../../../features/onboarding/SetupChecklist/CompletedBody';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { MenuRow } from './MenuRow';
import { UpdateNotice } from './UpdateNotice';

type Props = {
  readonly version: string | null;
  readonly progress: OnboardingProgress;
  readonly hasUpdate: boolean;
  readonly hasDraft: boolean;
  readonly onReport: () => void;
  readonly onOpenChangelog: () => void;
  readonly onOpenShortcuts: () => void;
  readonly onSponsor: () => void;
  readonly onFollowX: () => void;
};

const MARK_SIZE = 16;

export const GoodboyMenu = ({
  version,
  progress,
  hasUpdate,
  hasDraft,
  onReport,
  onOpenChangelog,
  onOpenShortcuts,
  onSponsor,
  onFollowX,
}: Props) => {
  const showsSetup = !progress.finished && progress.hasProjects;

  return (
    <>
      <header className="flex items-center gap-1.5 px-3 py-2">
        <DogMascot size={MARK_SIZE} className="shrink-0 text-foreground" />
        <span className="truncate text-label font-semibold text-foreground">
          {version === null ? 'Goodboy' : `Goodboy ${version}`}
        </span>
        <Eyebrow label="Beta" muted />
      </header>
      <Divider />
      <div className="flex flex-col gap-2 py-2">
        <ul className="flex flex-col">
          <MenuRow
            icon={<CONCEPT_ICONS.reportIssue size={ICON_SIZE.row} aria-hidden />}
            label="Report a bug"
            trailing={
              <span className="flex items-center gap-2 text-secondary text-faint-foreground">
                {hasDraft ? 'Draft saved' : null}
                <kbd className="font-sans">{shortcutGlyphs('report.open')}</kbd>
              </span>
            }
            onClick={onReport}
          />
        </ul>
        {hasUpdate ? (
          <div className="px-2">
            <UpdateNotice />
          </div>
        ) : null}
        {showsSetup && progress.isDone ? (
          <div className="flex flex-col gap-2 px-3">
            <CompletedBody />
          </div>
        ) : null}
        {showsSetup && !progress.isDone ? (
          <section aria-label="Setup" className="flex flex-col gap-1.5 px-1.5">
            <Eyebrow
              label={`Setup · ${progress.completedCount} of ${progress.totalCount}`}
              className="px-1.5"
            />
            <ChecklistBody progress={progress} />
            <Button variant="ghost" size="sm" onClick={() => finish()} className="self-end">
              Skip setup
            </Button>
          </section>
        ) : null}
        <ul className="flex flex-col">
          <MenuRow
            icon={<CONCEPT_ICONS.changelog size={ICON_SIZE.row} aria-hidden />}
            label="What's new"
            onClick={onOpenChangelog}
          />
          <MenuRow
            icon={<CONCEPT_ICONS.shortcuts size={ICON_SIZE.row} aria-hidden />}
            label="Keyboard shortcuts"
            trailing={
              <kbd className="font-sans text-secondary text-faint-foreground">
                {shortcutGlyphs('settings.shortcuts')}
              </kbd>
            }
            onClick={onOpenShortcuts}
          />
          <MenuRow
            icon={<Heart size={ICON_SIZE.row} aria-hidden />}
            label="Sponsor on GitHub"
            trailing={
              <ExternalLink size={ICON_SIZE.row} aria-hidden className="text-faint-foreground" />
            }
            onClick={onSponsor}
          />
          <MenuRow
            icon={<XIcon size={ICON_SIZE.row} aria-hidden />}
            label="Follow on X"
            trailing={
              <ExternalLink size={ICON_SIZE.row} aria-hidden className="text-faint-foreground" />
            }
            onClick={onFollowX}
          />
        </ul>
      </div>
      <Divider />
      <p className="px-3 py-2 text-2xs leading-relaxed text-faint-foreground">
        Releases land often, so expect rough edges. The app is free and source-available, and a
        sponsorship pays for the time that goes into it.
      </p>
    </>
  );
};
