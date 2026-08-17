import { useState } from 'react';
import { SegmentedTabs } from '@goodboy/ui';
import type { SessionExternalTaskProvider, WorkspaceId } from '@goodboy/types';
import { ExternalTaskChip } from '../../../integrations/components/ExternalTaskChip';
import { IssuePicker } from '../../../integrations/components/IssuePicker';
import { useIssueCandidates } from '../../../integrations/hooks/useIssueCandidates';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import type { IssueSource } from '../../../integrations/issueSources';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sources: ReadonlyArray<IssueSource>;
  readonly value: IssueCandidate | null;
  readonly disabled: boolean;
  readonly onPick: (candidate: IssueCandidate) => void;
  readonly onClear: () => void;
};

export const IssueSourceField = ({
  workspaceId,
  sources,
  value,
  disabled,
  onPick,
  onClear,
}: Props) => {
  const [choice, setChoice] = useState<SessionExternalTaskProvider | null>(null);
  const active = sources.find((source) => source.provider === choice) ?? sources[0] ?? null;
  const provider = active?.provider ?? 'linear';
  const { rows, isLoading, isLoaded, error, load } = useIssueCandidates({ workspaceId, provider });

  const selectProvider = (next: SessionExternalTaskProvider) => {
    setChoice(next);
    onClear();
  };

  return (
    <div className="flex flex-col gap-2">
      {sources.length > 1 && (
        <SegmentedTabs
          ariaLabel="Issue source"
          options={sources.map((source) => ({
            value: source.provider,
            label: source.label,
            disabled,
          }))}
          value={provider}
          onChange={selectProvider}
          size="sm"
        />
      )}
      {value != null ? (
        <div role="group" aria-label="Linked task" className="flex flex-col gap-2">
          <ExternalTaskChip
            task={value}
            appearance="row"
            variant="full"
            navigation="external"
            hasReferenceActions={false}
          />
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="w-fit rounded-md px-2 py-1 text-xs font-medium text-muted-foreground motion-safe:transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            Change task
          </button>
        </div>
      ) : (
        <IssuePicker
          rows={rows}
          isLoading={isLoading}
          isLoaded={isLoaded}
          error={error}
          value={value}
          placeholder={`Search ${active?.label ?? ''} issues assigned to you…`}
          disabled={disabled}
          onOpen={load}
          onPick={onPick}
          onClear={onClear}
        />
      )}
    </div>
  );
};
