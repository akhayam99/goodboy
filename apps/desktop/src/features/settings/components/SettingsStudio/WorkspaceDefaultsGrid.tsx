import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { Band, Input, Switch } from '@goodboy/ui';
import { VerbositySelect } from '../../../../features/session/components/VerbositySelect';
import { DEFAULT_BRANCH_PREFIX } from '../../../../features/settings/settings';
import { useAppStore } from '../../../../store';
import { selectWorkspaceResolvedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';
import type { WorkspaceOverridesPatch } from '../../../../store/slices/overrides/patchWorkspaceOverrides';
import { isAttributionEnabled } from '../../../../shared/utils/attribution';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { BranchTemplateField } from './BranchTemplateField';
import { WorkspaceFieldRow } from './WorkspaceFieldRow';

type Props = {
  readonly workspaceId: WorkspaceId;
};

type PersistParams = {
  readonly patch: WorkspaceOverridesPatch;
  readonly failureTitle: string;
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
  const patchWorkspaceOverrides = useAppStore((s) => s.patchWorkspaceOverrides);
  const verbosity = useAppStore(
    (s) => selectWorkspaceResolvedSettings({ state: s, workspaceId }).defaultVerbosity,
  );
  const parallelAgents = useAppStore(
    (s) => selectWorkspaceResolvedSettings({ state: s, workspaceId }).parallelAgents,
  );
  const resolvedBranchPrefix = useAppStore(
    (s) => selectWorkspaceResolvedSettings({ state: s, workspaceId }).defaultBranchPrefix,
  );
  const reportError = useAppStore((s) => s.reportError);
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [savedBranchPrefix, setSavedBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [busy, setBusy] = useState(false);
  const attributionFooter = isAttributionEnabled({ overrides: wsOverrides });

  useEffect(() => {
    setBranchPrefix(resolvedBranchPrefix);
    setSavedBranchPrefix(resolvedBranchPrefix);
  }, [workspaceId, resolvedBranchPrefix]);

  const persistOverrides = async ({ patch, failureTitle }: PersistParams) => {
    setBusy(true);
    try {
      await patchWorkspaceOverrides({ workspaceId, patch });
    } catch (err) {
      void reportError({ title: failureTitle, error: err, workspaceId });
    } finally {
      setBusy(false);
    }
  };

  const commitBranchPrefix = async () => {
    const cleaned = committedPrefix(branchPrefix);
    const next = cleaned === '' ? DEFAULT_BRANCH_PREFIX : cleaned;
    if (next === savedBranchPrefix) {
      setBranchPrefix(next);
      return;
    }
    setBusy(true);
    try {
      await patchWorkspaceOverrides({ workspaceId, patch: { defaultBranchPrefix: next } });
      setBranchPrefix(next);
      setSavedBranchPrefix(next);
    } catch (err) {
      void reportError({ title: "Couldn't save the branch prefix", error: err, workspaceId });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Band
        inset="content"
        label="Branches and comments"
        ariaLabel="Branches and comments"
        icon={<CONCEPT_ICONS.branch size={ICON_SIZE.row} aria-hidden />}
        headingLevel={2}
      >
        <WorkspaceFieldRow
          workspaceId={workspaceId}
          field="branchPrefix"
          help="Starts every new session branch. Letters, numbers, - and /."
        >
          <Input
            type="text"
            value={branchPrefix}
            onChange={(e) => setBranchPrefix(sanitized(e.target.value))}
            onBlur={() => void commitBranchPrefix()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void commitBranchPrefix();
              }
            }}
            placeholder={DEFAULT_BRANCH_PREFIX}
            disabled={busy}
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
            label={attributionFooter ? 'On' : 'Off'}
            checked={attributionFooter}
            disabled={busy}
            onChange={(next) =>
              void persistOverrides({
                patch: { attributionFooter: next },
                failureTitle: "Couldn't save the attribution line setting",
              })
            }
          />
        </WorkspaceFieldRow>
      </Band>

      <Band
        inset="content"
        label="Agents"

        ariaLabel="Agents"
        icon={<CONCEPT_ICONS.agents size={ICON_SIZE.row} aria-hidden />}
        headingLevel={2}
      >
        <WorkspaceFieldRow
          workspaceId={workspaceId}
          field="parallelAgents"
          help="Lets eligible agents split independent work and reconcile it in one output."
        >
          <Switch
            label={parallelAgents ? 'On' : 'Off'}
            checked={parallelAgents}
            disabled={busy}
            onChange={(next) =>
              void persistOverrides({
                patch: { parallelAgents: next },
                failureTitle: "Couldn't save the parallel agents setting",
              })
            }
          />
        </WorkspaceFieldRow>
        <WorkspaceFieldRow
          workspaceId={workspaceId}
          field="verbosity"
          help="How much agents explain while they work."
        >
          <VerbositySelect
            value={verbosity}
            onChange={(v) =>
              void persistOverrides({
                patch: { defaultVerbosity: v },
                failureTitle: "Couldn't save the output verbosity",
              })
            }
            disabled={busy}
          />
        </WorkspaceFieldRow>
      </Band>
    </>
  );
};
