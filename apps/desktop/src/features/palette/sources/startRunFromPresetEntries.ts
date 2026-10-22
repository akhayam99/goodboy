import type { SessionId, Workflow } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { RUN_ROUTE_COPY } from '../../session/startRun/runRouteCopy';
import type { PaletteEntry } from '../types';

type OpenParams = {
  readonly sessionId: SessionId;
  readonly text: string;
};

type Params = {
  readonly sessionId: SessionId;
  readonly workflows: ReadonlyArray<Workflow>;
  readonly open: (params: OpenParams) => void;
};

export const startRunFromPresetEntries = ({
  sessionId,
  workflows,
  open,
}: Params): ReadonlyArray<PaletteEntry> =>
  workflows
    .filter((workflow) => workflow.isPreset === true)
    .map((workflow): PaletteEntry => ({
      key: `start-run-from:${workflow.id}`,
      label: RUN_ROUTE_COPY.fromPreset({ name: workflow.name }),
      kind: 'action',
      group: 'workflow',
      icon: CONCEPT_ICONS.workflows,
      detail: RUN_ROUTE_COPY.closeness.follow,
      run: () => open({ sessionId, text: `~${workflow.name} ` }),
    }));
