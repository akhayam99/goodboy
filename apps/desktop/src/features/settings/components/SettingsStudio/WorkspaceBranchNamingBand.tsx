import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { Band, Input } from '@goodboy/ui';
import { DEFAULT_BRANCH_PREFIX } from '../../../../features/settings/settings';
import { useAppStore } from '../../../../store';
import { selectWorkspaceResolvedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';
import { useWorkspaceOverrideSave } from '../../hooks/useWorkspaceOverrideSave';
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
  const resolvedBranchPrefix = useAppStore(
    (s) => selectWorkspaceResolvedSettings({ state: s, workspaceId }).defaultBranchPrefix,
  );
  const [draftPrefix, setDraftPrefix] = useState<string | null>(null);
  const prefixSave = useWorkspaceOverrideSave({
    workspaceId,
    field: 'branchPrefix',
    saved: resolvedBranchPrefix,
    patchOf: ({ value }) => ({ defaultBranchPrefix: value }),
  });

  useEffect(() => {
    setDraftPrefix(null);
  }, [workspaceId]);

  const commitBranchPrefix = () => {
    if (draftPrefix === null) {
      return;
    }
    const cleaned = committedPrefix({ input: draftPrefix });
    const next = cleaned === '' ? DEFAULT_BRANCH_PREFIX : cleaned;
    setDraftPrefix(null);
    if (next === prefixSave.value) {
      return;
    }
    void prefixSave.save({ value: next });
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
          value={draftPrefix ?? prefixSave.value}
          onChange={(e) => setDraftPrefix(sanitized({ input: e.target.value }))}
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
    </Band>
  );
};
