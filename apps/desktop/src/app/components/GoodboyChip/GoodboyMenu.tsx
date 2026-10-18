import { ArrowUpCircle, Heart, Smartphone } from 'lucide-react';
import { Divider, XIcon, type MenuEntry } from '@goodboy/ui';
import { AppMenuList } from '../../../features/actions/AppMenuList';
import type { OnboardingProgress } from '../../../features/onboarding/hooks/useOnboardingProgress';
import { SetupSection } from '../../../features/onboarding/SetupChecklist/SetupSection';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { NAMES } from '../../../shared/names';
import { BrandLockup } from './BrandLockup';

type RailUpdate = {
  readonly label: string;
  readonly onOpen: () => void;
};

type Props = {
  readonly version: string | null;
  readonly progress: OnboardingProgress;
  readonly isMainWindow: boolean;
  readonly hasDraft: boolean;
  readonly railUpdate: RailUpdate | null;
  readonly onClose: () => void;
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
  hasDraft,
  railUpdate,
  onClose,
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
  const reportGlyph = shortcutGlyphs('report.open');

  const updateEntries: ReadonlyArray<MenuEntry> =
    railUpdate === null
      ? []
      : [
          {
            kind: 'item',
            key: 'update',
            label: railUpdate.label,
            icon: ArrowUpCircle,
            onSelect: railUpdate.onOpen,
          },
          { kind: 'separator', key: 'update-end' },
        ];

  const entries: ReadonlyArray<MenuEntry> = [
    ...updateEntries,
    { kind: 'header', key: 'help', label: 'Help' },
    {
      kind: 'item',
      key: 'guide',
      label: 'Guide',
      icon: CONCEPT_ICONS.guide,
      onSelect: onOpenGuide,
    },
    {
      kind: 'item',
      key: 'whats-new',
      label: NAMES.whatsNew,
      icon: CONCEPT_ICONS.changelog,
      onSelect: onOpenChangelog,
    },
    {
      kind: 'item',
      key: 'shortcuts',
      label: 'Keyboard shortcuts',
      icon: CONCEPT_ICONS.shortcuts,
      hint: shortcutGlyphs('settings.shortcuts'),
      onSelect: onOpenShortcuts,
    },
    {
      kind: 'item',
      key: 'report',
      label: 'Report a bug',
      icon: CONCEPT_ICONS.reportIssue,
      hint: hasDraft ? `Draft saved ${reportGlyph}` : reportGlyph,
      onSelect: onReport,
    },
    { kind: 'separator', key: 'goodboy-start' },
    { kind: 'header', key: 'goodboy', label: 'Goodboy' },
    {
      kind: 'item',
      key: 'pair',
      label: NAMES.pairIphone,
      icon: Smartphone,
      onSelect: onPairDevice,
    },
    {
      kind: 'item',
      key: 'sponsor',
      label: 'Sponsor on GitHub',
      icon: Heart,
      isExternal: true,
      onSelect: onSponsor,
    },
    {
      kind: 'item',
      key: 'follow',
      label: 'Follow on X',
      icon: XIcon,
      isExternal: true,
      onSelect: onFollowX,
    },
  ];

  return (
    <>
      <header className="flex min-w-0 items-center gap-2 px-3 py-2 text-label">
        <BrandLockup version={version} hasMeta={false} />
        <button
          type="button"
          onClick={onOpenChangelog}
          aria-label={`Open ${NAMES.whatsNew}`}
          className="min-w-0 truncate rounded-sm text-meta tabular-nums text-faint-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {version === null ? 'Beta' : `${version} · Beta`}
        </button>
      </header>
      <Divider />
      {showsSetup ? (
        <div className="py-2">
          <SetupSection progress={progress} isMainWindow={isMainWindow} onLeave={onLeave} />
        </div>
      ) : null}
      <AppMenuList label="Goodboy" entries={entries} onClose={onClose} />
    </>
  );
};
