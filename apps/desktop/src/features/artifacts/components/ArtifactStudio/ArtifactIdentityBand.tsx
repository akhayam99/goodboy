import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Divider, IconButton, MetaRow, StudioDetailTabs } from '@goodboy/ui';
import type { SessionArtifact } from '@goodboy/types';
import { ArtifactExportActions } from './ArtifactExportActions';
import { ArtifactStatusChip } from './ArtifactStatusChip';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { formatCompactDateTime } from '../../../../shared/utils/formatCompactDateTime';

export type ArtifactDetailTab = 'artifact' | 'conversation';

type Props = {
  readonly artifact: SessionArtifact;
  readonly creatorName: string;
  readonly tabs: ReadonlyArray<{ readonly value: ArtifactDetailTab; readonly label: string }>;
  readonly tab: ArtifactDetailTab;
  readonly onTabChange: (next: ArtifactDetailTab) => void;
};

export const ArtifactIdentityBand = ({ artifact, creatorName, tabs, tab, onTabChange }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const DisclosureIcon = isOpen ? ChevronUp : ChevronDown;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <h2
          data-testid="artifact-title"
          className="min-w-0 shrink truncate text-sm font-semibold leading-snug text-foreground"
        >
          {artifact.title}
        </h2>
        <ArtifactStatusChip kind={artifact.kind} status={artifact.status} />
        <span className="flex min-w-0 shrink items-center gap-1.5 text-2xs text-muted-foreground">
          <CONCEPT_ICONS.agents size={11} aria-hidden className="shrink-0 text-primary" />
          <span className="truncate">{creatorName}</span>
        </span>
        <IconButton
          variant="ghost"
          icon={DisclosureIcon}
          iconSize={12}
          label="Artifact details"
          tooltip={isOpen ? 'Hide the artifact details' : 'Show the artifact details'}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((previous) => !previous)}
          data-testid="artifact-details-toggle"
          className="shrink-0"
        />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <StudioDetailTabs
            ariaLabel="Artifact sections"
            options={tabs}
            value={tab}
            onChange={onTabChange}
          />
          <Divider orientation="vertical" className="h-4" />
          <ArtifactExportActions artifact={artifact} />
        </div>
      </div>
      {isOpen ? (
        <MetaRow
          items={[
            <span key="kind">{artifact.kind}</span>,
            artifact.workflowRunId !== null ? (
              <span key="run">workflow run</span>
            ) : (
              <span key="run">standalone</span>
            ),
            <span key="revision">rev {artifact.revision}</span>,
            <span key="created" className="tabular-nums">
              {formatCompactDateTime({ iso: artifact.createdAt })}
            </span>,
          ]}
        />
      ) : null}
    </div>
  );
};
