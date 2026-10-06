import { Button, KbdPill } from '@goodboy/ui';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { fixOpenLabel, openCommentsLine } from '../../reviewBulkCopy';

type Props = {
  readonly count: number;
  readonly onFix: () => void;
};

export const FixOpenLine = ({ count, onFix }: Props) => (
  <div className="flex min-w-0 flex-wrap items-center gap-3">
    <span className="text-label text-foreground">{openCommentsLine({ count })}</span>
    <Button size="sm" variant="secondary" onClick={onFix} className="gap-2">
      {fixOpenLabel({ count })}
      <KbdPill aria-hidden className="h-4 min-w-4 text-chip">
        {shortcutGlyphs('review.selectAll')}
      </KbdPill>
    </Button>
  </div>
);
