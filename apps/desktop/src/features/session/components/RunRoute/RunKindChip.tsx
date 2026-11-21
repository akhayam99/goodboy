import { useMemo } from 'react';
import { ChevronDown } from '@goodboy/ui/icons';
import { AnchoredPopover, Button, cn, ICON_SIZE, Tooltip, useDropdown } from '@goodboy/ui';
import type { RunRoute, Workflow, WorkspaceId } from '@goodboy/types';
import { FactButton } from '../../../../shared/components/SettingChip/FactButton';
import { FactDot } from '../../../../shared/components/SettingChip/FactDot';
import { useIsSettingFact } from '../../../../shared/components/SettingChip/settingLookContext';
import { useAppStore } from '../../../../store';
import type { RunRouteChoice, RunRouteTarget } from '../../startRun/changeRunRoute';
import { runKindOfRoute } from '../../startRun/runKindOfRoute';
import { RUN_ROUTE_COPY } from '../../startRun/runRouteCopy';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';
import { RunKindChoices } from './RunKindChoices';
import type { RunKindPhase } from './runKindPhaseOf';
import { runKindChoicesOf } from './runKindChoicesOf';
import { useRunRouteChange } from './useRunRouteChange';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly target: RunRouteTarget;
  readonly route: RunRoute;
  readonly changeCount: number;
  readonly phase: RunKindPhase;
};

type ChooseParams = {
  readonly choice: RunRouteChoice;
};

const NO_TEMPLATES: ReadonlyArray<Workflow> = [];

const RUN_KIND_HEADING = {
  unstarted: RUN_ROUTE_COPY.changeTo,
  ended: RUN_ROUTE_COPY.restartAs,
  finished: RUN_ROUTE_COPY.startNewAs,
} as const satisfies Record<Exclude<RunKindPhase, 'live'>, string>;

const RUN_KIND_CONSEQUENCE = {
  unstarted: RUN_ROUTE_COPY.inPlace,
  live: RUN_ROUTE_COPY.liveReadOnly,
  ended: RUN_ROUTE_COPY.restart,
  finished: RUN_ROUTE_COPY.secondRun,
} as const satisfies Record<RunKindPhase, string>;

export const RunKindChip = ({ workspaceId, target, route, changeCount, phase }: Props) => {
  const dropdown = useDropdown({ expectedHeight: 360, expectedWidth: 320, width: 'w-80' });
  const templates = useAppStore((state) => state.phaseTemplates[workspaceId] ?? NO_TEMPLATES);
  const presets = useMemo(
    () => templates.filter((template) => template.isPreset === true),
    [templates],
  );
  const change = useRunRouteChange({ target });
  const isFact = useIsSettingFact();
  const kind = runKindOfRoute({ route });
  const choices = runKindChoicesOf({ route, presets });
  const presetId = presets.find((preset) => preset.name === route.presetName)?.id ?? null;
  const why = route.why.trim();
  const whyLine = [
    why === '' ? null : ORCHESTRATED_COPY.why({ reason: why }),
    changeCount === 0 ? null : ORCHESTRATED_COPY.changes({ count: changeCount }),
  ]
    .filter((part) => part !== null)
    .join(' · ');
  const choose = async ({ choice }: ChooseParams) => {
    const outcome = await change.choose({ choice, shouldEndRun: phase === 'ended' });
    if (outcome === null || outcome === 'in-place' || outcome === 'unchanged') {
      return;
    }
    dropdown.close();
  };

  const ariaLabel = `${RUN_ROUTE_COPY.kind}: ${kind.name}, ${RUN_ROUTE_COPY.setAtStart}`;
  const fact = (
    <Tooltip content={kind.what} isSuppressed={dropdown.open}>
      <FactButton
        aria-haspopup="dialog"
        aria-expanded={dropdown.open}
        aria-label={ariaLabel}
        data-setting-chip={RUN_ROUTE_COPY.kind}
        data-run-route={route.shape}
        onClick={dropdown.toggle}
      >
        {kind.name}
      </FactButton>
    </Tooltip>
  );
  const chip = (
    <Button
      size="xs"
      variant="secondary"
      aria-haspopup="dialog"
      aria-expanded={dropdown.open}
      aria-label={ariaLabel}
      data-setting-chip={RUN_ROUTE_COPY.kind}
      data-run-route={route.shape}
      onClick={dropdown.toggle}
      className={cn(dropdown.open && 'bg-selected')}
    >
      <span className="text-foreground">{kind.name}</span>
      <ChevronDown size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
    </Button>
  );

  const popover = (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={RUN_ROUTE_COPY.kind}
      anchorClassName="inline-flex"
      className="flex flex-col gap-2 p-3"
      trigger={isFact ? fact : chip}
    >
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-row text-foreground">{kind.name}</span>
        <span className="shrink-0 text-meta text-faint-foreground">
          {RUN_ROUTE_COPY.setAtStart}
        </span>
      </div>
      <p className="text-meta text-muted-foreground">{kind.what}</p>
      {whyLine === '' ? null : (
        <p data-run-kind-why="" className="text-meta text-muted-foreground">
          {whyLine}
        </p>
      )}
      {phase === 'live' ? null : (
        <RunKindChoices
          choices={choices}
          closeness={
            route.shape === 'plan' && kind.shape === 'preset' ? (route.closeness ?? 'adapt') : null
          }
          presetId={presetId}
          heading={RUN_KIND_HEADING[phase]}
          isBusy={change.isBusy}
          onChoose={(params) => void choose(params)}
        />
      )}
      <p data-run-kind-consequence="" className="text-meta text-faint-foreground">
        {RUN_KIND_CONSEQUENCE[phase]}
      </p>
    </AnchoredPopover>
  );
  if (!isFact) {
    return popover;
  }
  return (
    <>
      <FactDot />
      {popover}
    </>
  );
};
