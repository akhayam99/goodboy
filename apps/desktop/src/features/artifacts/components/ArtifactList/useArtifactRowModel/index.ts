import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import type { ArtifactListRow as Row } from '../../../artifactListRows';
import type { ArtifactState } from '../../../artifactStateOf';
import { ARTIFACT_KIND_MARKER_LABEL } from '../../../artifactPresentation';
import { formatDateTime } from '../../../../../shared/utils/time/formatDateTime';
import type { ActionControls } from '../../../../actions/useActionControls';
import { useActionControls } from '../../../../actions/useActionControls';
import { useObjectMenuTrigger } from '../../../../actions/useObjectMenuTrigger';
import type { ArtifactActionTarget, ResolvedAction } from '../../../../actions/types';

type Params = {
  readonly row: Row;
  readonly rowKey: string;
  readonly sessionId: SessionId;
  readonly isStateShown: boolean;
};

const PRIMARY_FALLBACK_IDS = ['artifact.stop', 'artifact.retry'] as const;

type FindParams = {
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly id: string;
};

const findAction = ({ actions, id }: FindParams): ResolvedAction | null =>
  actions.find((action) => action.id === id) ?? null;

type PrimaryParams = {
  readonly row: Row;
  readonly controls: ActionControls;
};

const primaryOf = ({ row, controls }: PrimaryParams): ResolvedAction | null => {
  const primary = controls.inSlot({ slot: 'primary' })[0] ?? null;
  if (primary !== null) {
    return primary;
  }
  for (const id of PRIMARY_FALLBACK_IDS) {
    const action = findAction({ actions: controls.actions, id });
    if (action !== null && row.target.kind === 'generation') {
      return action;
    }
  }
  return null;
};

type TargetParams = {
  readonly row: Row;
  readonly sessionId: SessionId;
};

const targetOf = ({ row, sessionId }: TargetParams): ArtifactActionTarget => ({
  kind: 'artifact',
  sessionId,
  subject:
    row.target.kind === 'generation'
      ? { kind: 'generation', generation: row.target.generation }
      : { kind: 'stored', artifactId: row.target.artifactId, isPlanRunning: row.isPlanRunning },
});

const GROUP_SAYS_IT: ReadonlySet<ArtifactState['key']> = new Set([
  'needs',
  'running',
  'available',
  'ran',
  'deleted',
]);

type ShownStateParams = {
  readonly row: Row;
  readonly isStateShown: boolean;
};

const shownStateOf = ({ row, isStateShown }: ShownStateParams): ArtifactState | null => {
  if (row.state === null || (!isStateShown && GROUP_SAYS_IT.has(row.state.key))) {
    return null;
  }
  return row.state;
};

export const useArtifactRowModel = ({ row, rowKey, sessionId, isStateShown }: Params) => {
  const target = useMemo(() => targetOf({ row, sessionId }), [row, sessionId]);
  const anchorKey = `artifact-row:${rowKey}`;
  const menu = useObjectMenuTrigger({ target, anchorKey });
  const controls = useActionControls({ target, anchorKey });
  const isDeleted = row.group === 'deleted';
  const hasOwnVerb = row.group === 'needs' || row.target.kind === 'generation';
  const primary = hasOwnVerb ? primaryOf({ row, controls }) : null;
  const at = row.deletedAt ?? row.at;
  return {
    menu,
    controls,
    isDeleted,
    hasParts: row.kind === 'plan' && row.partCount > 0 && !isDeleted,
    label: `${ARTIFACT_KIND_MARKER_LABEL[row.kind]} ${row.title}${row.state === null ? '' : `, ${row.state.label}`}`,
    restoreAction: isDeleted
      ? findAction({ actions: controls.actions, id: 'artifact.restore' })
      : null,
    primary,
    isFilled: primary !== null && primary.slot === 'primary' && primary.isSecondary !== true,
    state: shownStateOf({ row, isStateShown }),
    at,
    atTitle:
      at === null
        ? undefined
        : `${isDeleted ? 'Deleted ' : ''}${formatDateTime({ at, hasYear: true })}`,
  };
};
