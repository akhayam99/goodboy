import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { Band, Input, Switch } from '@goodboy/ui';
import { VerbositySelect } from '../../../../features/session/components/VerbositySelect';
import { DEFAULT_BRANCH_PREFIX } from '../../../../features/settings/settings';
import { useAppStore } from '../../../../store';
import { selectWorkspaceResolvedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';
import { isAttributionEnabled } from '../../../../shared/utils/attribution';
import { useIsWorkOn } from '../../../../shared/hooks/useIsWorkOn';
import { useWorkspaceOverrideSave } from '../../hooks/useWorkspaceOverrideSave';
import { AutoLevelDefaultRow } from './AutoLevelDefaultRow';
import { AutonomyDefaultsBand } from './AutonomyDefaultsBand';
import { BranchTemplateField } from './BranchTemplateField';
import { RunDefaultField } from './RunDefaultField';
import { WorkspaceFieldRow } from './WorkspaceFieldRow';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const sanitized = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9/-]+/g, '')
    .replace(/\/{2,}/g, '/')
    .replace(/^[-/]+/, '')
    .slice(0, 16);

const committedPrefix = (input: string): string => input.trim().replace(/[-/]+$/, '');

export const WorkspaceDefaultsGrid = ({ workspaceId }: Props) => {
  const wsOverrides = useAppStore((s) => s.workspaceOverrides[workspaceId] ?? null);
  const verbosity = useAppStore(
    (s) => selectWorkspaceResolvedSettings({ state: s, workspaceId }).defaultVerbosity,
  );
  const parallelAgents = useAppStore(
    (s) => selectWorkspaceResolvedSettings({ state: s, workspaceId }).parallelAgents,
  );
  const resolvedBranchPrefix = useAppStore(
    (s) => selectWorkspaceResolvedSettings({ state: s, workspaceId }).defaultBranchPrefix,
  );
  const isWorkOn = useIsWorkOn();
  const [draftPrefix, setDraftPrefix] = useState<string | null>(null);
  const prefixSave = useWorkspaceOverrideSave({
    workspaceId,
    field: 'branchPrefix',
    saved: resolvedBranchPrefix,
    patchOf: ({ value }) => ({ defaultBranchPrefix: value }),
  });
  const attributionSave = useWorkspaceOverrideSave({
    workspaceId,
    field: 'attribution',
    saved: isAttributionEnabled({ overrides: wsOverrides }),
    patchOf: ({ value }) => ({ attributionFooter: value }),
  });
  const parallelSave = useWorkspaceOverrideSave({
    workspaceId,
    field: 'parallelAgents',
    saved: parallelAgents,
    patchOf: ({ value }) => ({ parallelAgents: value }),
  });
  const verbositySave = useWorkspaceOverrideSave({
    workspaceId,
    field: 'verbosity',
    saved: verbosity,
    patchOf: ({ value }) => ({ defaultVerbosity: value }),
  });

  useEffect(() => {
    setDraftPrefix(null);
  }, [workspaceId]);

  const commitBranchPrefix = () => {
    if (draftPrefix === null) {
      return;
    }
    const cleaned = committedPrefix(draftPrefix);
    const next = cleaned === '' ? DEFAULT_BRANCH_PREFIX : cleaned;
    setDraftPrefix(null);
    if (next === prefixSave.value) {
      return;
    }
    void prefixSave.save({ value: next });
  };

  return (
    <>
      <Band
        inset="content"
        label="Branches and comments"
        ariaLabel="Branches and comments"
        headingLevel={2}
      >
        <WorkspaceFieldRow
          workspaceId={workspaceId}
          field="branchPrefix"
          help="Starts every new session branch. Letters, numbers, - and /."
        >
          <Input
            type="text"
            value={draftPrefix ?? prefixSave.value}
            onChange={(e) => setDraftPrefix(sanitized(e.target.value))}
            onBlur={commitBranchPrefix}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitBranchPrefix();
              }
            }}
            placeholder={DEFAULT_BRANCH_PREFIX}
            maxLength={16}
            spellCheck={false}
            autoComplete="off"
            aria-label="Branch prefix"
            className="w-40 font-mono"
          />
        </WorkspaceFieldRow>
        <WorkspaceFieldRow
          workspaceId={workspaceId}
          field="branchTemplate"
          layout="stacked"
          help="The name a new session branch gets. Existing branches keep their names."
        >
          <BranchTemplateField workspaceId={workspaceId} />
        </WorkspaceFieldRow>
        <WorkspaceFieldRow
          workspaceId={workspaceId}
          field="attribution"
          help="Signs every comment and review reply Goodboy posts."
        >
          <Switch
            ariaLabel="Attribution line"
            checked={attributionSave.value}
            onChange={(next) => void attributionSave.save({ value: next })}
          />
        </WorkspaceFieldRow>
      </Band>

      <Band
        inset="content"
        label="Agents"

        ariaLabel="Agents"
        headingLevel={2}
      >
        <WorkspaceFieldRow
          workspaceId={workspaceId}
          field="parallelAgents"
          help="Lets eligible agents split independent work and reconcile it in one output."
        >
          <Switch
            ariaLabel="Parallel agents"
            checked={parallelSave.value}
            onChange={(next) => void parallelSave.save({ value: next })}
          />
        </WorkspaceFieldRow>
        <WorkspaceFieldRow
          workspaceId={workspaceId}
          field="verbosity"
          help="How much agents explain while they work."
        >
          <VerbositySelect
            value={verbositySave.value}
            onChange={(v) => void verbositySave.save({ value: v })}
            disabled={false}
          />
        </WorkspaceFieldRow>
        <RunDefaultField workspaceId={workspaceId} />
        {isWorkOn ? null : <AutoLevelDefaultRow workspaceId={workspaceId} />}
      </Band>
      {isWorkOn ? <AutonomyDefaultsBand workspaceId={workspaceId} /> : null}
    </>
  );
};
