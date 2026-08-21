import { useState } from 'react';
import { X } from 'lucide-react';
import { IconButton, SegmentedTabs } from '@goodboy/ui';
import type { SessionExternalTaskProvider, WorkspaceId } from '@goodboy/types';
import { ExternalTaskChip } from '../../../integrations/components/ExternalTaskChip';
import { IntegrationGlyph } from '../../../integrations/components/IntegrationGlyph';
import { IssuePicker } from '../../../integrations/components/IssuePicker';
import { useIssueCandidates } from '../../../integrations/hooks/useIssueCandidates';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import type { IssueSource } from '../../../integrations/issueSources';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sources: ReadonlyArray<IssueSource>;
  readonly values: ReadonlyArray<IssueCandidate>;
  readonly disabled: boolean;
  readonly onPick: (candidate: IssueCandidate) => void;
  readonly onRemove: (candidate: IssueCandidate) => void;
};

export const IssueSourceField = ({
  workspaceId,
  sources,
  values,
  disabled,
  onPick,
  onRemove,
}: Props) => {
  const [choice, setChoice] = useState<SessionExternalTaskProvider | null>(null);
  const [pickCount, setPickCount] = useState(0);
  const active = sources.find((source) => source.provider === choice) ?? sources[0] ?? null;
  const provider = active?.provider ?? 'linear';
  const { rows, isLoading, isLoaded, error, load } = useIssueCandidates({ workspaceId, provider });

  const pick = (candidate: IssueCandidate) => {
    setPickCount((count) => count + 1);
    onPick(candidate);
  };

  return (
    <div className="flex flex-col gap-2">
      {sources.length > 1 && (
        <SegmentedTabs
          ariaLabel="Issue source"
          options={sources.map((source) => ({
            value: source.provider,
            label: source.label,
            glyph: <IntegrationGlyph provider={source.provider} size="xs" />,
            disabled,
          }))}
          value={provider}
          onChange={setChoice}
          size="sm"
        />
      )}
      {values.length > 0 ? (
        <div
          role="group"
          aria-label="Linked tasks"
          data-testid="new-session-linked-tasks"
          className="flex flex-col gap-2"
        >
          {values.map((value) => (
            <div
              key={`${value.provider}:${value.externalId}`}
              className="flex min-w-0 items-center gap-2"
            >
              <div className="min-w-0 flex-1">
                <ExternalTaskChip
                  task={value}
                  appearance="row"
                  variant="full"
                  navigation="external"
                  hasReferenceActions={false}
                />
              </div>
              <IconButton
                icon={X}
                label={`Remove ${value.identifier}`}
                onClick={() => onRemove(value)}
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      ) : null}
      <IssuePicker
        key={pickCount}
        rows={rows}
        isLoading={isLoading}
        isLoaded={isLoaded}
        error={error}
        value={null}
        placeholder={
          values.length > 0
            ? `Search ${active?.label ?? ''} issues to add another…`
            : `Search ${active?.label ?? ''} issues assigned to you…`
        }
        disabled={disabled}
        onOpen={load}
        onPick={pick}
        onClear={() => undefined}
      />
    </div>
  );
};
