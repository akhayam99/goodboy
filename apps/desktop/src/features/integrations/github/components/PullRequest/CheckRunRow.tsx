import type { ReactNode } from 'react';
import type { PrCheckRun } from '@goodboy/types';
import { FOCUS_RING, FactCard, ROW_INTERACTIVE, cn } from '@goodboy/ui';
import { useObjectMenuTrigger } from '../../../../actions/useObjectMenuTrigger';
import { formatDuration } from '../../../../../shared/utils/time/formatDuration';
import { CheckConclusionIcon } from './CheckConclusionIcon';
import { checkCardOf, checkFootnoteOf } from './checkCardOf';

export type CheckRunRowParts = {
  readonly footnote?: string;
  readonly work?: ReactNode;
  readonly isAgentWorking?: boolean;
  readonly action?: ReactNode;
  readonly hint?: ReactNode;
  readonly isExpanded?: boolean;
  readonly controlsId?: string;
  readonly onOpen: () => void;
};

type Props = CheckRunRowParts & {
  readonly check: PrCheckRun;
};

type DurationParams = Pick<Props, 'check'>;

const durationOf = ({ check }: DurationParams): string =>
  check.durationMs === null ? '' : (formatDuration({ durationMs: check.durationMs }) ?? '');

export const CheckRunRow = ({
  check,
  footnote,
  work,
  isAgentWorking = false,
  action,
  hint,
  isExpanded,
  controlsId,
  onOpen,
}: Props) => {
  const menu = useObjectMenuTrigger({
    target: { kind: 'checkRun', facts: { name: check.name, url: check.detailsUrl, onOpen } },
    anchorKey: `check-run:${check.name}`,
  });
  return (
    <li
      data-check-row={check.name}
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
      className="group/row col-span-full grid grid-cols-subgrid items-center"
    >
      <FactCard
        card={checkCardOf({
          check,
          footnote: footnote ?? checkFootnoteOf({ detailsUrl: check.detailsUrl }),
        })}
      >
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={controlsId}
          onClick={onOpen}
          className={cn(
            'grid w-full min-w-0 grid-cols-[16px_minmax(0,1fr)_56px] items-center gap-2 rounded-md px-2 py-1 text-left text-body transition-colors',
            ROW_INTERACTIVE,
            FOCUS_RING,
          )}
        >
          <CheckConclusionIcon conclusion={check.conclusion} />
          <span className="min-w-0 truncate text-foreground">{check.name}</span>
          <span className="text-right text-meta tabular-nums text-faint-foreground">
            {isAgentWorking ? null : durationOf({ check })}
          </span>
        </button>
      </FactCard>
      <span data-check-action="" className="flex items-center justify-end">
        {action}
      </span>
      {work === null || work === undefined ? null : (
        <div className="col-span-full grid grid-cols-[16px_minmax(0,1fr)] gap-2 px-2">
          <div data-check-status="" className="col-start-2 min-w-0">
            {work}
          </div>
        </div>
      )}
      {hint === null || hint === undefined ? null : <div className="col-span-full">{hint}</div>}
    </li>
  );
};
