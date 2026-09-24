import type { ReactNode } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { Button, Divider, IconButton, PANE_RHYTHM, StudioDetailTabs, cn } from '@goodboy/ui';
import type { SessionArtifact } from '@goodboy/types';
import { ArtifactExportActions } from './ArtifactExportActions';
import { ArtifactStatusChip } from './ArtifactStatusChip';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

export type ArtifactDetailTab = 'artifact' | 'conversation';

type Props = {
  readonly artifact: SessionArtifact;
  readonly tabs: ReadonlyArray<{ readonly value: ArtifactDetailTab; readonly label: string }>;
  readonly tab: ArtifactDetailTab;
  readonly stateChip: ReactNode;
  readonly actions: ReactNode;
  readonly isDetailsOpen: boolean;
  readonly onTabChange: (next: ArtifactDetailTab) => void;
  readonly onDetailsToggle: () => void;
  readonly onBack: () => void;
};

export const ArtifactIdentityBand = ({
  artifact,
  tabs,
  tab,
  stateChip,
  actions,
  isDetailsOpen,
  onTabChange,
  onDetailsToggle,
  onBack,
}: Props) => {
  const DisclosureIcon = isDetailsOpen ? ChevronUp : ChevronDown;

  return (
    <div
      data-testid="artifact-band"
      className={cn('flex h-11 shrink-0 items-center gap-2', PANE_RHYTHM.detail.band)}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="shrink-0"
        data-testid="artifact-back"
      >
        <ArrowLeft size={ICON_SIZE.row} aria-hidden />
        All artifacts
      </Button>
      <h2
        data-testid="artifact-title"
        className="min-w-0 shrink truncate text-sm font-semibold leading-snug text-foreground"
      >
        {artifact.title}
      </h2>
      <ArtifactStatusChip kind={artifact.kind} status={artifact.status} />
      {stateChip}
      <IconButton
        variant="ghost"
        icon={DisclosureIcon}
        iconSize={12}
        label="Artifact details"
        tooltip={isDetailsOpen ? 'Hide the artifact details' : 'Show the artifact details'}
        aria-expanded={isDetailsOpen}
        onClick={onDetailsToggle}
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
        {actions}
        <ArtifactExportActions artifact={artifact} />
      </div>
    </div>
  );
};
