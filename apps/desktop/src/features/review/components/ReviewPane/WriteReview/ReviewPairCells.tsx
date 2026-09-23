import { cn as tokenCn, tintClasses as tokenTintClasses } from '@goodboy/ui';
import { cn } from '@goodboy/ui';
import type { DiffHunkLine } from '@goodboy/types';
import type { DiffLinePair } from '../../../../../shared/utils/diffLinePairs';
import { DiffLineText } from '../../../../permissions/components/DiffViewerDialog/DiffLineText';
import type { SyntaxLang } from '../../../../permissions/components/DiffViewerDialog/highlight';
import { ReviewLineActions } from './ReviewLineActions';
import type { ReviewLineTarget } from './ReviewFileDiff';

type Props = {
  readonly pair: DiffLinePair;
  readonly lang: SyntaxLang | null;
  readonly oldTarget: ReviewLineTarget | null;
  readonly newTarget: ReviewLineTarget | null;
  readonly isOldActive: boolean;
  readonly isNewActive: boolean;
  readonly hasOldDraft: boolean;
  readonly hasNewDraft: boolean;
  readonly onToggleComposer: ((target: ReviewLineTarget) => void) | null;
  readonly onAskAgent: ((target: ReviewLineTarget) => void) | null;
};

type SideStateParams = {
  readonly line: DiffHunkLine | null;
  readonly hasDraft: boolean;
};

const sideTone = ({ line, hasDraft }: SideStateParams): string => {
  if (line === null) {
    return 'bg-subtle';
  }
  if (hasDraft) {
    return tokenCn(tokenTintClasses('draft').bgSoft);
  }
  if (line.kind === 'add') {
    return tokenCn(tokenTintClasses('success').bgSoft);
  }
  if (line.kind === 'del') {
    return tokenCn(tokenTintClasses('danger').bgSoft);
  }
  return '';
};

const sideAccent = ({ line, hasDraft }: SideStateParams): string => {
  if (hasDraft) {
    return tokenCn(tokenTintClasses('draft').border);
  }
  if (line?.kind === 'add') {
    return tokenCn(tokenTintClasses('success').border);
  }
  if (line?.kind === 'del') {
    return tokenCn(tokenTintClasses('danger').border);
  }
  return 'border-transparent';
};

const ACTIONS_CLASS = 'select-none border-l-2 px-0.5 align-top';
const GUTTER_CLASS = 'select-none px-1.5 text-right align-top text-3xs tabular-nums';
const CONTENT_CLASS = 'whitespace-pre-wrap wrap-anywhere px-2.5 align-top text-foreground';

export const ReviewPairCells = ({
  pair,
  lang,
  oldTarget,
  newTarget,
  isOldActive,
  isNewActive,
  hasOldDraft,
  hasNewDraft,
  onToggleComposer,
  onAskAgent,
}: Props) => {
  const oldTone = sideTone({ line: pair.old, hasDraft: hasOldDraft });
  const newTone = sideTone({ line: pair.new, hasDraft: hasNewDraft });
  const newAccent = sideAccent({ line: pair.new, hasDraft: hasNewDraft });
  return (
    <>
      <td
        className={cn(
          ACTIONS_CLASS,
          sideAccent({ line: pair.old, hasDraft: hasOldDraft }),
          oldTone,
        )}
      >
        <ReviewLineActions
          target={oldTarget}
          isActive={isOldActive}
          onToggleComposer={onToggleComposer}
          onAskAgent={onAskAgent}
        />
      </td>
      <td className={cn(GUTTER_CLASS, 'text-faint-foreground', oldTone)}>
        {pair.old?.oldLine ?? ''}
      </td>
      <td className={cn(CONTENT_CLASS, oldTone)}>
        {pair.old === null ? '' : <DiffLineText line={pair.old} lang={lang} />}
      </td>
      <td
        className={cn(
          ACTIONS_CLASS,
          newAccent === 'border-transparent' ? 'border-border-soft' : newAccent,
          newTone,
        )}
      >
        <ReviewLineActions
          target={newTarget}
          isActive={isNewActive}
          onToggleComposer={onToggleComposer}
          onAskAgent={onAskAgent}
        />
      </td>
      <td className={cn(GUTTER_CLASS, 'text-faint-foreground', newTone)}>
        {pair.new?.newLine ?? ''}
      </td>
      <td className={cn(CONTENT_CLASS, newTone)}>
        {pair.new === null ? '' : <DiffLineText line={pair.new} lang={lang} />}
      </td>
    </>
  );
};
