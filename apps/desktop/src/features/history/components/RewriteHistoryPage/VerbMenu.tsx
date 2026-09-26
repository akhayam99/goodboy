import { ChevronDown } from 'lucide-react';
import { OverflowMenu, cn, type OverflowMenuItem } from '@goodboy/ui';
import type { BranchCommit, HistoryStep } from '@goodboy/types';
import { VERB_LINE, VERB_WORD } from '../../historyPlan';

type Props = {
  readonly step: HistoryStep;
  readonly older: ReadonlyArray<BranchCommit>;
  readonly isOnOrigin: boolean;
  readonly disabled: boolean;
  readonly onPick: () => void;
  readonly onReword: () => void;
  readonly onSquash: () => void;
  readonly onFold: (target: string) => void;
  readonly onDrop: () => void;
  readonly onMove: (direction: 'newer' | 'older') => void;
};

const short = ({ sha }: { readonly sha: string }): string => sha.slice(0, 7);

export const verbLabel = ({ step }: { readonly step: HistoryStep }): string =>
  step.verb === 'fixup' && step.target != null
    ? `${VERB_WORD.fixup} ${short({ sha: step.target })}`
    : VERB_WORD[step.verb];

export const VerbMenu = ({
  step,
  older,
  isOnOrigin,
  disabled,
  onPick,
  onReword,
  onSquash,
  onFold,
  onDrop,
  onMove,
}: Props) => {
  const items: ReadonlyArray<OverflowMenuItem> = [
    {
      kind: 'item',
      key: 'pick',
      label: 'Pick',
      description: VERB_LINE.pick,
      hint: 'P',
      onClick: onPick,
    },
    {
      kind: 'item',
      key: 'reword',
      label: 'Reword',
      description: VERB_LINE.reword,
      hint: 'R',
      onClick: onReword,
    },
    {
      kind: 'item',
      key: 'squash',
      label: 'Squash into the one below',
      description: VERB_LINE.squash,
      hint: 'S',
      disabled: older.length === 0,
      onClick: onSquash,
    },
    {
      kind: 'item',
      key: 'drop',
      label: 'Drop',
      description: VERB_LINE.drop,
      hint: 'D',
      destructive: true,
      onClick: onDrop,
    },
    { kind: 'separator', key: 'fold-rule' },
    { kind: 'header', key: 'fold-header', label: 'Fold into…' },
    ...(older.length === 0
      ? [{ kind: 'empty' as const, key: 'fold-empty', label: 'No older commit to fold into' }]
      : older.map((commit, index) => ({
          kind: 'item' as const,
          key: `fold-${commit.sha}`,
          label: `${commit.shortSha} ${commit.subject}`,
          ...(index === 0 && { description: VERB_LINE.fixup }),
          hint: index === 0 ? 'F' : undefined,
          onClick: () => onFold(commit.sha),
        }))),
    { kind: 'separator', key: 'move-rule' },
    {
      kind: 'item',
      key: 'move-up',
      label: 'Move up',
      description: VERB_LINE.move,
      hint: '⌥↑',
      onClick: () => onMove('newer'),
    },
    {
      kind: 'item',
      key: 'move-down',
      label: 'Move down',
      hint: '⌥↓',
      onClick: () => onMove('older'),
    },
  ];
  const line = step.verb === 'fixup' ? VERB_LINE.fixup : VERB_LINE[step.verb];

  return (
    <OverflowMenu
      items={items}
      label={`What happens to ${short({ sha: step.sha })}`}
      tooltip={isOnOrigin ? `${line} This commit is on origin.` : line}
      disabled={disabled}
      align="right"
      triggerClassName="w-40 px-2"
      trigger={
        <span
          className={cn(
            'flex min-w-0 items-center justify-between gap-1 text-label',
            step.verb === 'pick' ? 'text-faint-foreground' : 'text-foreground',
            step.verb === 'drop' && 'text-danger',
          )}
        >
          <span className="truncate">{verbLabel({ step })}</span>
          <ChevronDown size={11} aria-hidden className="shrink-0" />
        </span>
      }
    />
  );
};
