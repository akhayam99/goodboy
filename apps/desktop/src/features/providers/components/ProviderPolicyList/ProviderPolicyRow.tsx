import type { KeyboardEvent, PointerEvent } from 'react';
import { GripVertical } from 'lucide-react';
import type { ProviderPolicyState } from '@goodboy/types';
import { Button, Tooltip, cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { PROVIDER_LABEL } from '../../providerLabel';
import type { PolicyRow } from '../../policy/policyRows';
import type { PolicyRowStatus } from '../../policy/policyRowStatus';
import { POLICY_STATE_LABEL } from '../../policy/policyStateLabel';
import { PolicyMarks } from './PolicyMarks';
import { PolicyStateSegment } from './PolicyStateSegment';

type Props = {
  readonly row: PolicyRow;
  readonly rank: number;
  readonly total: number;
  readonly status: PolicyRowStatus;
  readonly isExpanded: boolean;
  readonly isDragging: boolean;
  readonly dropIndex: number | undefined;
  readonly onToggleExpand: () => void;
  readonly onState: (state: ProviderPolicyState) => void;
  readonly onToggleKeepAfterLimit: () => void;
  readonly onGripDown: (event: PointerEvent) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLLIElement>) => void;
};

export const ProviderPolicyRow = ({
  row,
  rank,
  total,
  status,
  isExpanded,
  isDragging,
  dropIndex,
  onToggleExpand,
  onState,
  onToggleKeepAfterLimit,
  onGripDown,
  onKeyDown,
}: Props) => {
  const name = PROVIDER_LABEL[row.id];
  const stateLabel = row.isNew ? 'New, not used' : POLICY_STATE_LABEL[row.state];
  return (
    <li
      tabIndex={0}
      data-policy-row={row.id}
      data-dropindex={dropIndex}
      aria-label={`${name}, position ${rank} of ${total}, ${stateLabel}. Alt plus arrow up or down moves it.`}
      onKeyDown={onKeyDown}
      className={cn(
        'flex flex-col rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        isDragging && 'opacity-50',
      )}
    >
      <div className="flex min-w-0 items-center gap-2 px-1 py-2">
        <Tooltip content={`Drag to reorder ${name}`}>
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Drag to reorder ${name}`}
            onPointerDown={onGripDown}
            className="flex shrink-0 cursor-grab items-center text-faint-foreground hover:text-foreground"
          >
            <GripVertical size={ICON_SIZE.control} aria-hidden />
          </button>
        </Tooltip>
        <span className="w-3 shrink-0 text-chip text-faint-foreground">{rank}</span>
        <ProviderGlyph id={row.id} size={ICON_SIZE.control} />
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={onToggleExpand}
          className="flex min-w-0 flex-1 flex-col items-start text-left"
        >
          <span className="flex items-center gap-2 text-row text-foreground">
            {name}
            {row.isNew ? (
              <span
                className={cn(
                  'rounded-sm px-1 text-chip',
                  tintClasses('primary').bgSoft,
                  tintClasses('primary').text,
                )}
              >
                New
              </span>
            ) : null}
          </span>
          <span className="w-full text-label text-muted-foreground">
            {status.text}
            {status.limit === null ? null : (
              <span className={tintClasses('warning').text}> · {status.limit}</span>
            )}
          </span>
        </button>
        {row.isNew ? (
          <Button size="sm" variant="secondary" onClick={() => onState('on')}>
            Turn on
          </Button>
        ) : (
          <PolicyStateSegment label={`${name} policy`} value={row.state} onChange={onState} />
        )}
      </div>
      {isExpanded ? (
        <PolicyMarks row={row} onToggleKeepAfterLimit={onToggleKeepAfterLimit} />
      ) : null}
    </li>
  );
};
