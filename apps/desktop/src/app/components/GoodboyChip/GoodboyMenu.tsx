import { ArrowUpCircle, Heart, Smartphone } from 'lucide-react';
import { Divider, type MenuEntry, FOCUS_RING, cn } from '@goodboy/ui';
import { AppMenuList } from '../../../features/actions/AppMenuList';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { destinationOf } from '../../../shared/navigation/destinationOf';
import { NAMES } from '../../../shared/utils/names';
import { BrandLockup } from './BrandLockup';

const GUIDE = destinationOf({ id: 'guide' });

const WHATS_NEW = destinationOf({ id: 'whatsNew' });

type RailUpdate = {
  readonly label: string;
  readonly onOpen: () => void;
};

type Props = {
  readonly version: string | null;
  readonly hasDraft: boolean;
  readonly railUpdate: RailUpdate | null;
  readonly onClose: () => void;
  readonly onReport: () => void;
  readonly onOpenGuide: () => void;
  readonly onPairDevice: () => void;
  readonly onOpenChangelog: () => void;
  readonly onOpenShortcuts: () => void;
  readonly onSponsor: () => void;
};

export const GoodboyMenu = ({
  version,
  hasDraft,
  railUpdate,
  onClose,
  onReport,
  onOpenGuide,
  onPairDevice,
  onOpenChangelog,
  onOpenShortcuts,
  onSponsor,
}: Props) => {
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
      label: GUIDE.label,
      icon: GUIDE.icon,
      onSelect: onOpenGuide,
    },
    {
      kind: 'item',
      key: 'whats-new',
      label: WHATS_NEW.label,
      icon: WHATS_NEW.icon,
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
  ];

  return (
    <>
      <header className="flex min-w-0 items-center gap-2 px-3 py-2 text-meta">
        <BrandLockup version={version} hasMeta={false} />
        <button
          type="button"
          onClick={onOpenChangelog}
          aria-label={`Open ${NAMES.whatsNew}`}
          className={cn(
            'min-w-0 truncate rounded-sm text-meta tabular-nums text-faint-foreground hover:text-foreground',
            FOCUS_RING,
          )}
        >
          {version === null ? 'Beta' : `${version} · Beta`}
        </button>
      </header>
      <Divider />
      <AppMenuList label="Goodboy" entries={entries} onClose={onClose} />
    </>
  );
};
