import type { ReactNode } from 'react';
import { SelectionBar, type SelectionVerb } from '@goodboy/ui';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { acceptCountLabel } from '../../reviewBulkCopy';
import { REVIEW_LAUNCH_LABEL, fixSelectedLabel } from '../../reviewLaunchCopy';

type Props = {
  readonly count: number;
  readonly total: number;
  readonly fixCount: number;
  readonly acceptCount: number;
  readonly isAccepting: boolean;
  readonly note: ReactNode;
  readonly onHeightChange: (height: number) => void;
  readonly onClear: () => void;
  readonly onSelectAll: () => void;
  readonly onFix: () => void;
  readonly onAccept: () => void;
};

export const ReviewSelectionBar = ({
  count,
  total,
  fixCount,
  acceptCount,
  isAccepting,
  note,
  onHeightChange,
  onClear,
  onSelectAll,
  onFix,
  onAccept,
}: Props) => {
  const verbs: ReadonlyArray<SelectionVerb> = [
    ...(fixCount === 0
      ? []
      : [
          {
            id: 'fix',
            label: fixSelectedLabel({ count: fixCount }),
            tone: 'primary' as const,
            hint: shortcutGlyphs('review.fix'),
            onRun: onFix,
          },
        ]),
    ...(acceptCount === 0
      ? []
      : [
          {
            id: 'accept',
            label: acceptCountLabel({ count: acceptCount }),
            tone: 'primary' as const,
            isBusy: isAccepting,
            onRun: onAccept,
          },
        ]),
  ];
  return (
    <SelectionBar
      ariaLabel={REVIEW_LAUNCH_LABEL.selectionBar}
      count={count}
      total={total}
      verbs={verbs}
      note={note}
      onHeightChange={onHeightChange}
      onClear={onClear}
      onSelectAll={onSelectAll}
      clearHint={shortcutGlyphs('selection.clear')}
      selectAllHint={shortcutGlyphs('review.selectAll')}
    />
  );
};
