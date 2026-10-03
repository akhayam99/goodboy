import { SelectionBar } from '@goodboy/ui';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { REVIEW_LAUNCH_LABEL, fixSelectedLabel } from '../../reviewLaunchCopy';

type Props = {
  readonly count: number;
  readonly total: number;
  readonly fixCount: number;
  readonly onClear: () => void;
  readonly onSelectAll: () => void;
  readonly onFix: () => void;
};

export const ReviewSelectionBar = ({
  count,
  total,
  fixCount,
  onClear,
  onSelectAll,
  onFix,
}: Props) => (
  <SelectionBar
    ariaLabel={REVIEW_LAUNCH_LABEL.selectionBar}
    count={count}
    total={total}
    verbs={
      fixCount === 0
        ? []
        : [
            {
              id: 'fix',
              label: fixSelectedLabel({ count: fixCount }),
              tone: 'primary',
              hint: shortcutGlyphs('review.fix'),
              onRun: onFix,
            },
          ]
    }
    onClear={onClear}
    onSelectAll={onSelectAll}
    clearHint={shortcutGlyphs('selection.clear')}
    selectAllHint={shortcutGlyphs('review.selectAll')}
  />
);
