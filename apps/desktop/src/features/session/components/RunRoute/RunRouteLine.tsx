import { useMemo } from 'react';
import type { RunRoute, Workflow, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import type { RunRouteTarget } from '../../startRun/changeRunRoute';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';
import { RUN_ROUTE_COPY } from '../../startRun/runRouteCopy';
import { RunRouteChangeMenu } from './RunRouteChangeMenu';
import { useRunRouteChange } from './useRunRouteChange';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly target: RunRouteTarget;
  readonly route: RunRoute;
  readonly changeCount: number;
};

const NO_TEMPLATES: ReadonlyArray<Workflow> = [];

const DOT = (
  <span aria-hidden className="text-faint-foreground">
    ·
  </span>
);

export const RunRouteLine = ({ workspaceId, target, route, changeCount }: Props) => {
  const templates = useAppStore((state) => state.phaseTemplates[workspaceId] ?? NO_TEMPLATES);
  const presets = useMemo(
    () => templates.filter((template) => template.isPreset === true),
    [templates],
  );
  const change = useRunRouteChange({ target });
  const Glyph = route.shape === 'plan' ? CONCEPT_ICONS.plan : CONCEPT_ICONS.auto;
  const presetId = presets.find((preset) => preset.name === route.presetName)?.id ?? null;
  const why = route.why.trim();

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div
        role="group"
        aria-label={RUN_ROUTE_COPY.routeLabel}
        data-run-route={route.shape}
        className="flex min-w-0 flex-wrap items-center gap-x-2 text-ui text-muted-foreground"
      >
        <Glyph size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
        <span className="min-w-0 truncate">{route.choice}</span>
        {changeCount === 0 ? null : DOT}
        {changeCount === 0 ? null : (
          <span>{ORCHESTRATED_COPY.changes({ count: changeCount })}</span>
        )}
        {why === '' ? null : DOT}
        {why === '' ? null : <span className="min-w-0 truncate">{why}</span>}
        {DOT}
        {route.changedTo === undefined ? (
          <RunRouteChangeMenu
            current={{ shape: route.shape, presetId, closeness: route.closeness ?? 'adapt' }}
            presets={presets}
            isBusy={change.isBusy}
            onChoose={(choice) => void change.choose(choice)}
            onSessionDefault={() =>
              void change.setSessionDefault({ sessionId: target.sessionId, shape: route.shape })
            }
          />
        ) : (
          <span className="text-foreground">{RUN_ROUTE_COPY.changedTo[route.changedTo]}</span>
        )}
      </div>
      {change.error === null ? null : (
        <p role="alert" className="text-label text-danger">
          {`${RUN_ROUTE_COPY.changeFailed}: ${change.error}`}
        </p>
      )}
    </div>
  );
};
