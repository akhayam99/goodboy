import type { WorkspaceId } from '@goodboy/types';
import { ICON_SIZE } from '@goodboy/ui';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { recommendedRoutingOf } from '../../../../shared/components/RoutingPicker/recommendationSummary';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { useAppStore } from '../../../../store';
import { selectProviderRule } from '../../../../store/slices/overrides/selectProviderRule';
import { RUN_MODEL_COPY } from '../../startRun/runModelCopy';
import { RunModelChip } from '../StartRun/RunModelChip';
import type { RunModelView } from '../StartRun/useRunModel';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly model: RunModelView;
  readonly isDisabled: boolean;
};

export const StartWhereItRuns = ({ workspaceId, model, isDisabled }: Props) => {
  const rule = useAppStore((state) => selectProviderRule({ state, workspaceId }));
  const { effective } = model;
  const routing = recommendedRoutingOf({
    provider: effective.provider,
    model: effective.model,
    effort: effective.effort,
  });
  const isLead = model.slot.kind === 'agent' && model.slot.agentKind === 'auto';
  const parts = [
    RUN_MODEL_COPY.onProvider({ name: model.label, provider: PROVIDER_LABEL[effective.provider] }),
    ...(routing.label === null ? [] : [...routing.label.name, ...routing.label.detail]),
    ...(isLead ? [RUN_MODEL_COPY.helpers[rule]] : []),
  ];
  return (
    <div
      role="group"
      aria-label={RUN_MODEL_COPY.whereItRuns}
      data-where-it-runs=""
      className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
    >
      <ProviderGlyph id={effective.provider} size={ICON_SIZE.row} />
      <p className="min-w-0 text-meta text-muted-foreground">{parts.join(' · ')}</p>
      <RunModelChip model={model} isDisabled={isDisabled} variant="change" />
    </div>
  );
};
