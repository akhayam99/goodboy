import { cn } from '@goodboy/ui';
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
const CONTENT_CLASS = 'whitespace-pre-wrap wrap-anywhere px-2.5 align-top text-foreground/80';
const COMMENTABLE_CLASS =
  'cursor-pointer transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60';

type ToneParams = {
  line: DiffHunkLine | null;
};

const sideTone = ({ line }: ToneParams): string => {
  if (line === null) {
    return 'bg-muted/20 text-transparent';
  }
  if (line.kind === 'add') {
    return 'bg-success/[0.07]';
  }
  if (line.kind === 'del') {
    return 'bg-danger/[0.07]';
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
          'border-l-2 text-muted-foreground/50',
          oldTone,
          oldRangeCommented
            ? 'border-warning/60'
            : pair.old?.kind === 'del'
              ? 'border-danger/50'
              : 'border-transparent',
          oldCommentable && COMMENTABLE_CLASS,
          selectingOld && 'bg-primary/15',
        )}
      >
        {pair.old?.oldLine ?? ''}
      </td>
      <td className={cn(CONTENT_CLASS, oldTone, selectingOld && 'bg-primary/15')}>
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
          'border-l-2 text-muted-foreground/50',
          newTone,
          newRangeCommented
            ? 'border-warning/60'
            : pair.new?.kind === 'add'
              ? 'border-success/50'
              : 'border-border-soft/40',
          newCommentable && COMMENTABLE_CLASS,
          selectingNew && 'bg-primary/15',
        )}
      >
        {pair.new?.newLine ?? ''}
      </td>
      <td className={cn(CONTENT_CLASS, newTone, selectingNew && 'bg-primary/15')}>
        {pair.new === null ? '' : <DiffLineText line={pair.new} lang={lang} />}
      </td>
    </>
  );
};
