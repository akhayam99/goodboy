import { Chip, Tooltip } from '@goodboy/ui';
import { MiddleText } from '../../../shared/components/MiddleText';
import { countNoun } from '../../../shared/utils/countNoun';
import type { MergeStep } from '../overlapGroupOf';

type Props = {
  readonly step: MergeStep;
  readonly position: number;
  readonly title: string;
  readonly reason: string;
};

const BRANCH_TAIL = /.{1,10}$/;

export const MergeStepRow = ({ step, position, title, reason }: Props) => (
  <li
    data-merge-step={step.mount.mountId}
    aria-current={step.isOwn ? 'true' : undefined}
    className="flex min-w-0 gap-2"
  >
    <span className="w-4 shrink-0 text-meta tabular-nums text-faint-foreground">{position}</span>
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Tooltip content={step.mount.branch}>
            <span
              data-branch={step.mount.branch}
              className="flex min-w-0 text-code text-foreground"
            >
              <MiddleText value={step.mount.branch} tail={BRANCH_TAIL} />
            </span>
          </Tooltip>
          {step.isOwn ? (
            <Chip
              tone="neutral"
              kind="state"
              emphasis="subtle"
              label="This branch"
              className="shrink-0"
            />
          ) : null}
        </div>
        <span className="shrink-0 text-meta tabular-nums text-faint-foreground">
          {countNoun({ count: step.mount.paths.length, one: 'file' })}
        </span>
      </div>
      <div className="flex min-w-0 text-meta">
        <span className="min-w-0 truncate text-muted-foreground">{title}</span>
        <span className="shrink-0 whitespace-pre text-faint-foreground">{` · ${reason}`}</span>
      </div>
    </div>
  </li>
);
