import { GitMerge } from 'lucide-react';
import type { AfterMergeRule, WorkspaceId } from '@goodboy/types';
import { Band, BandRow, Button } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { DEFAULT_AFTER_MERGE_RULE } from '../../../../store/slices/branch-cleanup';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { openSettings } from '../../../settings/openSettings';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const RULE_SENTENCE: Readonly<Record<AfterMergeRule, string>> = {
  ask: 'After a pull request merges, Goodboy asks before it deletes the branch.',
  local: 'After a pull request merges, Goodboy deletes the branch on this Mac.',
  'local-and-origin': 'After a pull request merges, Goodboy deletes the branch here and on origin.',
};

export const AfterMergeRuleLine = ({ workspaceId }: Props) => {
  const rule = useAppStore(
    (state) => state.workspaceOverrides[workspaceId]?.afterMerge ?? DEFAULT_AFTER_MERGE_RULE,
  );
  return (
    <Band ariaLabel="After a merge">
      <BandRow>
        <GitMerge size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 text-label text-foreground">{RULE_SENTENCE[rule]}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openSettings({ scope: 'workspace', section: 'after-merge' })}
        >
          Change
        </Button>
      </BandRow>
    </Band>
  );
};
