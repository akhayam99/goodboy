import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { Band, Input } from '@goodboy/ui';
import { DEFAULT_BRANCH_PREFIX } from '../../../../features/settings/settings';
import { useAppStore } from '../../../../store';
import { selectWorkspaceResolvedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';
import { NOTHING_CHANGED } from '../../../../store/slices/notifications/errorRecovery';
import { BranchTemplateField } from './BranchTemplateField';
import { WorkspaceFieldRow } from './WorkspaceFieldRow';

type Props = {
  readonly workspaceId: WorkspaceId;
};

type PrefixParams = {
  readonly input: string;
};

const sanitized = ({ input }: PrefixParams): string =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9/-]+/g, '')
    .replace(/\/{2,}/g, '/')
    .replace(/^[-/]+/, '')
    .slice(0, 16);

const committedPrefix = ({ input }: PrefixParams): string => input.trim().replace(/[-/]+$/, '');

export const WorkspaceBranchNamingBand = ({ workspaceId }: Props) => {
  const patchWorkspaceOverrides = useAppStore((s) => s.patchWorkspaceOverrides);
  const resolvedBranchPrefix = useAppStore(
    (s) => selectWorkspaceResolvedSettings({ state: s, workspaceId }).defaultBranchPrefix,
  );
  const reportError = useAppStore((s) => s.reportError);
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [savedBranchPrefix, setSavedBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    setBranchPrefix(resolvedBranchPrefix);
    setSavedBranchPrefix(resolvedBranchPrefix);
  }, [workspaceId, resolvedBranchPrefix]);

  const commitBranchPrefix = async () => {
    const cleaned = committedPrefix({ input: branchPrefix });
    const next = cleaned === '' ? DEFAULT_BRANCH_PREFIX : cleaned;
    if (next === savedBranchPrefix) {
      setBranchPrefix(next);
      return;
    }
    setIsBusy(true);
    try {
      await patchWorkspaceOverrides({ workspaceId, patch: { defaultBranchPrefix: next } });
      setBranchPrefix(next);
      setSavedBranchPrefix(next);
    } catch (err) {
      setBranchPrefix(savedBranchPrefix);
      void reportError({
        title: "Couldn't save the branch prefix",
        error: err,
        workspaceId,
        recovery: NOTHING_CHANGED,
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Band inset="content" label="Naming" ariaLabel="Naming" headingLevel={2}>
      <WorkspaceFieldRow
        workspaceId={workspaceId}
        field="branchPrefix"
        help="Starts every new session branch. Letters, numbers, - and /."
      >
        <Input
          type="text"
          value={branchPrefix}
          onChange={(e) => setBranchPrefix(sanitized({ input: e.target.value }))}
          onBlur={() => void commitBranchPrefix()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              void commitBranchPrefix();
            }
          }}
          placeholder={DEFAULT_BRANCH_PREFIX}
          disabled={isBusy}
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
    </Band>
  );
};
