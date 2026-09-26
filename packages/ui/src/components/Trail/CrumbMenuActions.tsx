import { cn } from '../../cn';
import { InlineConfirm } from '../InlineConfirm';
import type { CrumbMenuAction } from './crumbMenuTypes';

type Props = {
  readonly actions: ReadonlyArray<CrumbMenuAction>;
  readonly confirmingId: string | null;
  readonly onConfirmingChange: (id: string | null) => void;
  readonly onRun: (action: CrumbMenuAction) => void;
};

export const CrumbMenuActions = ({ actions, confirmingId, onConfirmingChange, onRun }: Props) => {
  const confirming = actions.find((action) => action.id === confirmingId) ?? null;

  if (confirming?.confirm != null) {
    const Icon = confirming.icon;
    return (
      <div data-crumb-actions="" className="flex flex-col rounded-md bg-fill p-1">
        <InlineConfirm
          role="danger"
          surface="plain"
          icon={<Icon size={12} aria-hidden />}
          title={confirming.confirm.title}
          description={confirming.confirm.description}
          confirmLabel={confirming.confirm.confirmLabel}
          onConfirm={() => onRun(confirming)}
          onCancel={() => onConfirmingChange(null)}
        />
      </div>
    );
  }

  return (
    <div data-crumb-actions="" className="flex flex-col rounded-md bg-fill p-1">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            role="menuitem"
            tabIndex={-1}
            data-crumb-action={action.id}
            onClick={() => {
              if (action.confirm != null) {
                onConfirmingChange(action.id);
                return;
              }
              onRun(action);
            }}
            className={cn(
              'flex h-7 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-label text-muted-foreground outline-none transition-colors',
              'hover:bg-hover hover:text-foreground focus:bg-hover focus:text-foreground',
            )}
          >
            <span className="flex size-5 shrink-0 items-center justify-center">
              <Icon size={14} aria-hidden />
            </span>
            <span className="min-w-0 truncate">{action.label}</span>
            {action.hint != null ? (
              <span className="min-w-0 truncate text-secondary text-faint-foreground">
                {action.hint}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};
