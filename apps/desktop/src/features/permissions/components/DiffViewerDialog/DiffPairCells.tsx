import { cn, tintClasses } from '@goodboy/ui';
import type { DiffCommentAnchor, DiffHunkLine } from '@goodboy/types';
import type { DiffLinePair } from '../../../../shared/utils/diffLinePairs';
import { DiffLineText } from './DiffLineText';
import type { SyntaxLang } from './highlight';

type Props = {
  pair: DiffLinePair;
  lang: SyntaxLang | null;
  canComment: boolean;
  oldAnchor: DiffCommentAnchor | null;
  newAnchor: DiffCommentAnchor | null;
  oldRangeCommented: boolean;
  newRangeCommented: boolean;
  selectingOld: boolean;
  selectingNew: boolean;
  onStartDrag: (anchor: DiffCommentAnchor) => void;
  onActivate: (anchor: DiffCommentAnchor) => void;
};

const GUTTER_CLASS = 'w-9 select-none px-1.5 text-right text-3xs tabular-nums';
const CONTENT_CLASS = 'whitespace-pre-wrap wrap-anywhere px-2.5 align-top text-foreground';
const COMMENTABLE_CLASS =
  'cursor-pointer transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring';

type ToneParams = {
  line: DiffHunkLine | null;
};

const sideTone = ({ line }: ToneParams): string => {
  if (line === null) {
    return 'bg-subtle text-transparent';
  }
  if (line.kind === 'add') {
    return cn(tintClasses('success').bgSoft);
  }
  if (line.kind === 'del') {
    return cn(tintClasses('danger').bgSoft);
  }
  return '';
};

export const DiffPairCells = ({
  pair,
  lang,
  canComment,
  oldAnchor,
  newAnchor,
  oldRangeCommented,
  newRangeCommented,
  selectingOld,
  selectingNew,
  onStartDrag,
  onActivate,
}: Props) => {
  const oldTone = sideTone({ line: pair.old });
  const newTone = sideTone({ line: pair.new });
  const oldCommentable = canComment && oldAnchor !== null;
  const newCommentable = canComment && newAnchor !== null;
  return (
    <>
      <td
        onPointerDown={
          oldCommentable
            ? (event) => {
                event.preventDefault();
                onStartDrag(oldAnchor);
              }
            : undefined
        }
        onKeyDown={
          oldCommentable
            ? (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                  return;
                }
                event.preventDefault();
                onActivate(oldAnchor);
              }
            : undefined
        }
        role={oldCommentable ? 'button' : undefined}
        tabIndex={oldCommentable ? 0 : undefined}
        aria-label={oldCommentable ? `comment on old line ${oldAnchor.lineNumber}` : undefined}
        className={cn(
          GUTTER_CLASS,
          'border-l-2 text-faint-foreground',
          oldTone,
          oldRangeCommented
            ? cn(tintClasses('warning').border)
            : pair.old?.kind === 'del'
              ? cn(tintClasses('danger').border)
              : 'border-transparent',
          oldCommentable && COMMENTABLE_CLASS,
          selectingOld && cn(tintClasses('primary').bg),
        )}
      >
        {pair.old?.oldLine ?? ''}
      </td>
      <td className={cn(CONTENT_CLASS, oldTone, selectingOld && cn(tintClasses('primary').bg))}>
        {pair.old === null ? '' : <DiffLineText line={pair.old} lang={lang} />}
      </td>
      <td
        onPointerDown={
          newCommentable
            ? (event) => {
                event.preventDefault();
                onStartDrag(newAnchor);
              }
            : undefined
        }
        onKeyDown={
          newCommentable
            ? (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                  return;
                }
                event.preventDefault();
                onActivate(newAnchor);
              }
            : undefined
        }
        role={newCommentable ? 'button' : undefined}
        tabIndex={newCommentable ? 0 : undefined}
        aria-label={newCommentable ? `comment on new line ${newAnchor.lineNumber}` : undefined}
        className={cn(
          GUTTER_CLASS,
          'border-l-2 text-faint-foreground',
          newTone,
          newRangeCommented
            ? cn(tintClasses('warning').border)
            : pair.new?.kind === 'add'
              ? cn(tintClasses('success').border)
              : 'border-border-soft',
          newCommentable && COMMENTABLE_CLASS,
          selectingNew && cn(tintClasses('primary').bg),
        )}
      >
        {pair.new?.newLine ?? ''}
      </td>
      <td className={cn(CONTENT_CLASS, newTone, selectingNew && cn(tintClasses('primary').bg))}>
        {pair.new === null ? '' : <DiffLineText line={pair.new} lang={lang} />}
      </td>
    </>
  );
};
