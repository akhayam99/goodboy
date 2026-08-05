import { useState } from 'react';
import { CircleCheck, X } from 'lucide-react';
import { CountToggle, Divider, ResizeHandle, ScrollFade, SelectableRow, cn } from '@goodboy/ui';
import type { PlanId, PlanWithCount } from '@goodboy/types';
import { useColumnWidth } from '../../../../shared/hooks/useColumnWidth';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';
import { fmtTimestamp } from './fmtTimestamp';
import { planStatusBadge } from './planStatusBadge';

type Props = {
  readonly plans: ReadonlyArray<PlanWithCount>;
  readonly selectedId: PlanId | null;
  readonly onSelect: (id: PlanId) => void;
  readonly onClose: () => void;
};

export const PlanListPanel = ({ plans, selectedId, onSelect, onClose }: Props) => {
  const [width, setWidth] = useColumnWidth(STORAGE_KEYS.planListWidth, 320);
  const [showFiled, setShowFiled] = useState(false);
  const active = plans.filter((plan) => plan.status === 'active');
  const filed = plans.filter((plan) => plan.status !== 'active');
  const visible = showFiled ? [...active, ...filed] : active;

  return (
    <div className="flex min-h-0 shrink-0">
      <ResizeHandle
        value={width}
        min={260}
        max={560}
        onChange={setWidth}
        onReset={() => setWidth(320)}
        side="right"
        ariaLabel="Resize plan list"
      />
      <div className="flex shrink-0 flex-col" style={{ width }}>
        <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5">
          <span className="text-xs font-medium text-foreground">all plans</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close plan list"
            className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
        <Divider />
        <ScrollFade className="min-h-0 flex-1">
          <ul className="flex w-full flex-col gap-1 px-3 py-3">
            {visible.map((plan, idx) => {
              const badge = planStatusBadge({ status: plan.status });
              return (
                <li key={plan.id}>
                  <SelectableRow
                    selected={plan.id === selectedId}
                    onClick={() => onSelect(plan.id)}
                    ariaCurrent={plan.id === selectedId ? 'true' : undefined}
                    className={cn(
                      'flex-col items-start gap-0.5 px-2 py-1.5',
                      plan.status === 'discarded' && 'opacity-60',
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-1.5">
                      <span className="shrink-0 text-2xs lowercase tracking-wide text-muted-foreground">
                        plan {idx + 1}
                      </span>
                      <span
                        className={cn(
                          'inline-flex w-20 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-2xs lowercase tracking-wide',
                          badge.className,
                        )}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <span className="line-clamp-2 text-xs text-foreground">{plan.title}</span>
                    <span className="text-2xs text-muted-foreground">
                      {fmtTimestamp(plan.createdAt)}
                    </span>
                  </SelectableRow>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-center px-3 pb-3">
            <CountToggle
              label="Consumed"
              itemsLabel="plans"
              count={filed.length}
              isShown={showFiled}
              icon={CircleCheck}
              onChange={setShowFiled}
            />
          </div>
        </ScrollFade>
      </div>
    </div>
  );
};
