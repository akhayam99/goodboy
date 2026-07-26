import { X } from 'lucide-react';
import { Divider, ResizeHandle, ScrollFade, cn } from '@goodboy/ui';
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

  return (
    <div className="flex min-h-0 shrink-0">
      <ResizeHandle
        value={width}
        min={260}
        max={560}
        onChange={setWidth}
        onReset={() => setWidth(320)}
        side="right"
        ariaLabel="resize plan list"
      />
      <div className="flex shrink-0 flex-col" style={{ width }}>
        <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5">
          <span className="text-xs font-medium text-foreground">all plans</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="close plan list"
            className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
        <Divider />
        <ScrollFade className="min-h-0 flex-1">
          <ul className="flex w-full flex-col gap-1 px-3 py-3">
            {plans.map((plan, idx) => {
              const badge = planStatusBadge({ status: plan.status });
              return (
                <li key={plan.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(plan.id)}
                    aria-current={plan.id === selectedId ? 'true' : undefined}
                    className={cn(
                      'flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors',
                      plan.id === selectedId ? 'bg-muted' : 'hover:bg-muted/40',
                      plan.status === 'discarded' && 'opacity-60',
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-1.5">
                      <span className="shrink-0 text-2xs lowercase tracking-wide text-muted-foreground">
                        plan {idx + 1}
                      </span>
                      <span
                        className={cn(
                          'inline-flex w-20 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] lowercase tracking-wide',
                          badge.className,
                        )}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <span className="line-clamp-2 text-xs text-foreground">{plan.title}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {fmtTimestamp(plan.createdAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </ScrollFade>
      </div>
    </div>
  );
};
