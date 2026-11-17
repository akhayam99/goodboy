import { ShellRailItem, type ShellRailMark } from '@goodboy/ui';
import { CircleAlert, ArrowUpCircle } from '@goodboy/ui/icons';
import { useAppStore } from '../../../store';
import { useUpdateCardState } from '../hooks/useUpdateCardState';
import { updatePillLabel } from '../updateCardCopy';
import { toggleUpdateCard } from '../updateCardRequest';
import { updateMarkOf, type UpdateMarkGlyph } from '../updateMark';

const GLYPH_ICON = {
  arrow: ArrowUpCircle,
  alert: CircleAlert,
} as const satisfies Record<UpdateMarkGlyph, typeof ArrowUpCircle>;

export const UpdateRailMark = () => {
  const { state, version, runningCount } = useUpdateCardState();
  const status = useAppStore((store) => store.updaterStatus);
  const progress = useAppStore((store) => store.updateProgress);

  if (state === null) {
    return null;
  }

  const mark = updateMarkOf({ state, status, progress });
  const label = updatePillLabel({ state, version, runningCount });
  const ring: ShellRailMark | null = mark.isDownloading
    ? {
        kind: 'ring',
        percent: mark.percent,
        name: mark.percent === null ? 'downloading' : `downloading, ${mark.percent}%`,
      }
    : null;

  return (
    <ShellRailItem
      id="update"
      icon={GLYPH_ICON[mark.glyph]}
      label={label}
      word={mark.word}
      tint={mark.tone}
      isEdged={mark.isEdged}
      isBreathing
      mark={ring}
      onSelect={toggleUpdateCard}
    />
  );
};
