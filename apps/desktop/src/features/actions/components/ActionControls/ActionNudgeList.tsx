import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ActionControls } from '../../useActionControls';

type Props = {
  readonly controls: ActionControls;
  readonly details?: Readonly<Record<string, ReactNode>>;
};

export const ActionNudgeList = ({ controls, details }: Props) => {
  const nudges = controls.inSlot({ slot: 'nudge' });
  if (nudges.length === 0) {
    return null;
  }
  return (
    <ul className="flex min-w-0 flex-col gap-2">
      {nudges.map((action) => {
        const Icon = action.icon;
        return (
          <li key={action.id} className="min-w-0">
            <button
              type="button"
              onClick={() => controls.trigger({ actionId: action.id })}
              className="group flex w-full min-w-0 items-center gap-3 rounded-lg bg-fill px-3 py-2.5 text-left text-body hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-safe:transition-colors"
            >
              <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="min-w-0 truncate text-row text-foreground">
                  {action.shortLabel}
                </span>
                {details?.[action.id] ?? null}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-secondary text-muted-foreground group-hover:text-foreground">
                {action.label}
                <ChevronRight size={ICON_SIZE.row} aria-hidden />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};
