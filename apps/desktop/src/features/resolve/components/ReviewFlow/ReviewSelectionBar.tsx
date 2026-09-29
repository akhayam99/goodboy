import { Button, KbdPill } from '@goodboy/ui';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { REVIEW_LAUNCH_LABEL, fixSelectedLabel, selectedLabel } from '../../reviewLaunchCopy';

type Props = {
  readonly count: number;
  readonly fixCount: number;
  readonly onClear: () => void;
  readonly onFix: () => void;
};

export const ReviewSelectionBar = ({ count, fixCount, onClear, onFix }: Props) => (
  <div
    role="toolbar"
    aria-label={REVIEW_LAUNCH_LABEL.selectionBar}
    className="mb-1 flex min-w-0 items-center gap-1.5 rounded-lg bg-elevated py-1 pl-2.5 pr-1 ring-1 ring-border-soft motion-safe:animate-studio-in"
  >
    <span className="whitespace-nowrap text-row text-foreground">{selectedLabel({ count })}</span>
    <Button size="sm" variant="ghost" onClick={onClear}>
      {REVIEW_LAUNCH_LABEL.clearSelection}
    </Button>
    <span className="flex-1" />
    {fixCount > 0 && (
      <Button size="sm" variant="primary" onClick={onFix}>
        {fixSelectedLabel({ count: fixCount })}
        <KbdPill
          aria-hidden
          className="ml-1 h-4 min-w-4 border-on-tone/30 bg-on-tone/15 text-meta text-on-tone"
        >
          {shortcutGlyphs('review.fix')}
        </KbdPill>
      </Button>
    )}
  </div>
);
