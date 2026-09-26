import { Divider, IconButton, OverflowMenu, type OverflowMenuItem } from '@goodboy/ui';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import type { ResolveUiState } from '../../resolveRowState';
import type { ResolveItemAction, ResolveItemActionId } from '../../resolveItemActions';
import { RESOLVE_ITEM_LABEL } from '../../resolveItemCopy';
import { ResolveStatusBadge } from '../ResolveStatusBadge';

export type PanelPosition = {
  readonly index: number;
  readonly total: number;
};

type Props = {
  readonly status: ResolveUiState;
  readonly location: string | null;
  readonly position: PanelPosition | null;
  readonly overflow: ReadonlyArray<ResolveItemAction>;
  readonly canPrevious: boolean;
  readonly canNext: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onAction: (id: ResolveItemActionId) => void;
  readonly onClose: () => void;
};

export const ResolvePanelHeader = ({
  status,
  location,
  position,
  overflow,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  onAction,
  onClose,
}: Props) => {
  const menuItems: ReadonlyArray<OverflowMenuItem> = overflow.map((item) => ({
    kind: 'item',
    key: item.id,
    label: item.label,
    disabled: item.disabledReason !== null,
    hint: item.disabledReason ?? undefined,
    onClick: () => onAction(item.id),
  }));
  return (
    <>
      <header
        aria-label={RESOLVE_ITEM_LABEL.comment}
        className="flex h-11 min-w-0 shrink-0 items-center gap-2 px-3"
      >
        <ResolveStatusBadge status={status} />
        <h2
          tabIndex={-1}
          data-resolve-heading
          className="min-w-0 flex-1 truncate font-mono text-2xs text-muted-foreground"
          title={location ?? RESOLVE_ITEM_LABEL.comment}
        >
          {location ?? RESOLVE_ITEM_LABEL.comment}
        </h2>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton
            icon={ChevronUp}
            label="Previous comment"
            variant="ghost"
            disabled={!canPrevious}
            onClick={onPrevious}
          />
          <IconButton
            icon={ChevronDown}
            label="Next comment"
            variant="ghost"
            disabled={!canNext}
            onClick={onNext}
          />
          {position !== null && (
            <span className="px-1 text-2xs tabular-nums text-muted-foreground">
              {position.index} of {position.total}
            </span>
          )}
          {menuItems.length > 0 && <OverflowMenu items={menuItems} label="More" align="right" />}
          <IconButton icon={X} label="Close conversation" variant="ghost" onClick={onClose} />
        </div>
      </header>
      <Divider />
    </>
  );
};
