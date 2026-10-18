import { ExternalLink, Heart, Smartphone } from 'lucide-react';
import { Divider, XIcon } from '@goodboy/ui';
import type { OnboardingProgress } from '../../../features/onboarding/hooks/useOnboardingProgress';
import { SetupSection } from '../../../features/onboarding/SetupChecklist/SetupSection';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { NAMES } from '../../../shared/names';
import { BrandLockup } from './BrandLockup';
import { MenuRow } from './MenuRow';
import { UpdateNotice } from './UpdateNotice';

type Props = {
  readonly version: string | null;
  readonly progress: OnboardingProgress;
  readonly isMainWindow: boolean;
  readonly hasUpdate: boolean;
  readonly hasDraft: boolean;
  readonly onLeave: () => void;
  readonly onReport: () => void;
  readonly onOpenGuide: () => void;
  readonly onPairDevice: () => void;
  readonly onOpenChangelog: () => void;
  readonly onOpenShortcuts: () => void;
  readonly onSponsor: () => void;
  readonly onFollowX: () => void;
};

export const GoodboyMenu = ({
  version,
  progress,
  isMainWindow,
  hasUpdate,
  hasDraft,
  onLeave,
  onReport,
  onOpenGuide,
  onPairDevice,
  onOpenChangelog,
  onOpenShortcuts,
  onSponsor,
  onFollowX,
}: Props) => {
  const showsSetup = !progress.isFinished && progress.hasProjects;

  return (
    <>
      <header className="flex items-center px-3 py-2 text-label">
        <BrandLockup version={version} />
      </header>
      <Divider />
      <div className="flex flex-col gap-2 py-2">
        {showsSetup ? (
          <SetupSection progress={progress} isMainWindow={isMainWindow} onLeave={onLeave} />
        ) : null}
        <ul className="flex flex-col">
          <MenuRow
            icon={<CONCEPT_ICONS.reportIssue size={ICON_SIZE.row} aria-hidden />}
            label="Report a bug"
            trailing={
              <span className="flex items-center gap-2 text-meta text-faint-foreground">
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
        <ul className="flex flex-col">
          <MenuRow
            icon={<CONCEPT_ICONS.guide size={ICON_SIZE.row} aria-hidden />}
            label="Guide"
            onClick={onOpenGuide}
          />
          <MenuRow
            icon={<CONCEPT_ICONS.changelog size={ICON_SIZE.row} aria-hidden />}
            label={NAMES.whatsNew}
            onClick={onOpenChangelog}
          />
          <MenuRow
            icon={<CONCEPT_ICONS.shortcuts size={ICON_SIZE.row} aria-hidden />}
            label="Keyboard shortcuts"
            trailing={
              <kbd className="font-sans text-meta text-faint-foreground">
                {shortcutGlyphs('settings.shortcuts')}
              </kbd>
            }
            onClick={onOpenShortcuts}
          />
          <MenuRow
            icon={<Smartphone size={ICON_SIZE.row} aria-hidden />}
            label="Pair your iPhone"
            onClick={onPairDevice}
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
      <p className="px-3 py-2 text-meta leading-relaxed text-faint-foreground">
        Releases land often, so expect rough edges. The app is free and source-available, and a
        sponsorship pays for the time that goes into it.
      </p>
    </>
  );
};
