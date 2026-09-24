import { Button, Divider, OverflowMenu, Tooltip } from '@goodboy/ui';
import type { OverflowMenuItem } from '@goodboy/ui';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ResolveQueueStatus } from '../../../../store/slices/resolve/deriveResolveQueueStatus';
import type {
  ResolveItemAction,
  ResolveItemActionId,
  ResolveItemActionSet,
} from '../../resolveItemActions';
import { RESOLVE_ITEM_LABEL } from '../../resolveItemCopy';
import { ResolveStatusBadge } from '../ResolveStatusBadge';

type Props = {
  readonly title: string;
  readonly location: string | null;
  readonly prNumber: number;
  readonly status: ResolveQueueStatus;
  readonly nextStep: string | null;
  readonly actions: ResolveItemActionSet;
  readonly isEditing: boolean;
  readonly canPrevious: boolean;
  readonly canNext: boolean;
  readonly onBack: () => void;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onAction: (id: ResolveItemActionId) => void;
};

type ActionButtonProps = {
  readonly action: ResolveItemAction;
  readonly isPrimary: boolean;
  readonly onAction: (id: ResolveItemActionId) => void;
};

const ActionButton = ({ action, isPrimary, onAction }: ActionButtonProps) => (
  <Tooltip content={action.disabledReason ?? action.label}>
    <Button
      size="sm"
      variant={isPrimary ? 'primary' : 'ghost'}
      {...(isPrimary && { 'data-resolve-primary': true })}
      disabled={action.disabledReason !== null}
      onClick={() => onAction(action.id)}
    >
      {action.label}
    </Button>
  </Tooltip>
);

export const ResolveItemHeader = ({
  title,
  location,
  prNumber,
  status,
  nextStep,
  actions,
  isEditing,
  canPrevious,
  canNext,
  onBack,
  onPrevious,
  onNext,
  onAction,
}: Props) => {
  const menuItems: ReadonlyArray<OverflowMenuItem> = actions.overflow.map((item) => ({
    kind: 'item',
    key: item.id,
    label: item.label,
    disabled: item.disabledReason !== null,
    hint: item.disabledReason ?? undefined,
    onClick: () => onAction(item.id),
  }));
  return (
    <>
      <header className="flex min-w-0 shrink-0 flex-col gap-2.5 px-5 py-3">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="flex min-w-0 flex-col items-start gap-1">
            <Button size="sm" variant="ghost" onClick={onBack}>
              <ArrowLeft className="size-3.5" aria-hidden />
              {RESOLVE_ITEM_LABEL.backToConversations}
            </Button>
            <div className="flex min-w-0 flex-col gap-1">
              <h2
                tabIndex={-1}
                data-resolve-heading
                className="break-words text-sm font-medium leading-5"
              >
                {title}
              </h2>
              <p className="break-all text-2xs text-muted-foreground">
                PR #{prNumber}
                {location !== null && ` · ${location}`}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-[auto_auto_auto] items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              aria-label="Previous comment"
              disabled={!canPrevious}
              onClick={onPrevious}
            >
              <ChevronLeft className="size-3.5" aria-hidden />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Next comment"
              disabled={!canNext}
              onClick={onNext}
            >
              <ChevronRight className="size-3.5" aria-hidden />
            </Button>
            {menuItems.length > 0 && (
              <OverflowMenu
                items={menuItems}
                label="More"
                align="right"
                trigger={<span className="text-2xs">More</span>}
              />
            )}
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 flex-col items-start gap-1">
            <ResolveStatusBadge status={status} />
            {nextStep !== null && <p className="text-2xs text-muted-foreground">{nextStep}</p>}
          </div>
          {!isEditing && (
            <div className="flex min-w-0 flex-wrap items-center gap-2 max-[320px]:[&>button]:w-full">
              {actions.secondary !== null && (
                <ActionButton action={actions.secondary} isPrimary={false} onAction={onAction} />
              )}
              {actions.primary !== null && (
                <ActionButton action={actions.primary} isPrimary onAction={onAction} />
              )}
            </div>
          )}
        </div>
      </header>
      <Divider />
    </>
  );
};
