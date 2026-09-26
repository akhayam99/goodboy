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
  readonly onOpenLocation?: (() => void) | null;
  readonly position: PanelPosition | null;
  readonly overflow: ReadonlyArray<ResolveItemAction>;
  readonly canPrevious: boolean;
  readonly canNext: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onAction: (id: ResolveItemActionId) => void;
  readonly onOpenAgentPage: (() => void) | null;
  readonly onClose: () => void;
};

export const OPEN_AGENT_PAGE_LABEL = 'Open agent full page';

export const ResolvePanelHeader = ({
  status,
  location,
  onOpenLocation = null,
  position,
  overflow,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  onAction,
  onOpenAgentPage,
  onClose,
}: Props) => {
  const actionItems: ReadonlyArray<OverflowMenuItem> = overflow.map((item) => ({
    kind: 'item',
    key: item.id,
    label: item.label,
    disabled: item.disabledReason !== null,
    hint: item.disabledReason ?? undefined,
    onClick: () => onAction(item.id),
  }));
  const menuItems: ReadonlyArray<OverflowMenuItem> =
    onOpenAgentPage === null
      ? actionItems
      : [
          ...actionItems,
          {
            kind: 'item',
            key: 'open_agent_page',
            label: OPEN_AGENT_PAGE_LABEL,
            onClick: onOpenAgentPage,
          },
        ];
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
          {onOpenLocation !== null && location !== null ? (
            <button
              type="button"
              onClick={onOpenLocation}
              aria-label={`Open ${location} in the diff`}
              className="max-w-full truncate rounded-sm hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {location}
            </button>
          ) : (
            (location ?? RESOLVE_ITEM_LABEL.comment)
          )}
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
