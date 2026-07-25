import { useState } from 'react';
import { cn } from '@goodboy/ui';
import type { SessionExternalTaskProvider, WorkspaceId } from '@goodboy/types';
import { IntegrationGlyph } from '../../../integrations/components/IntegrationGlyph';
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
        <div role="tablist" aria-label="issue source" className="flex flex-wrap items-center gap-1">
          {sources.map((source) => {
            const isActive = source.provider === provider;
            return (
              <button
                key={source.provider}
                type="button"
                role="tab"
                aria-selected={isActive}
                disabled={disabled}
                onClick={() => selectProvider(source.provider)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-medium motion-safe:transition-colors',
                  isActive
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-border-soft text-muted-foreground hover:border-border hover:text-foreground',
                  disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <IntegrationGlyph provider={source.provider} size="xs" />
                {source.label}
              </button>
            );
          })}
        </div>
      )}
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
    </div>
  );
};
