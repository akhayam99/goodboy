import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button, Divider, InlineConfirm, PANE_RHYTHM, cn } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ArtifactCreationRouting } from '../../../../store/slices/artifactDrafts/types';
import type { ArtifactCreationGate } from '../../artifactCreationGate';
import { ArtifactRoutingControl } from './ArtifactRoutingControl';

export const GENERATE_REASON_ID = 'artifact-generate-reason';

type Props = {
  readonly generateLabel: string;
  readonly gate: ArtifactCreationGate;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly recommendation: ArtifactCreationRouting;
  readonly routing: ArtifactCreationRouting | null;
  readonly isStarting: boolean;
  readonly isDiscardArmed: boolean;
  readonly hasDraft: boolean;
  readonly error: string | null;
  readonly onRouting: (routing: ArtifactCreationRouting | null) => void;
  readonly onCancel: () => void;
  readonly onArmDiscard: () => void;
  readonly onDisarmDiscard: () => void;
  readonly onDiscard: () => void;
  readonly onGenerate: () => void;
};

export const ArtifactCreationFooter = ({
  generateLabel,
  gate,
  connectedProviders,
  recommendation,
  routing,
  isStarting,
  isDiscardArmed,
  hasDraft,
  error,
  onRouting,
  onCancel,
  onArmDiscard,
  onDisarmDiscard,
  onDiscard,
  onGenerate,
}: Props) => (
  <>
    <Divider />
    <footer className="shrink-0">
      <div
        className={cn(
          'flex items-center justify-between gap-3',
          PANE_RHYTHM.column,
          PANE_RHYTHM.dock,
        )}
      >
        <ArtifactRoutingControl
          connectedProviders={connectedProviders}
          recommendation={recommendation}
          routing={routing}
          isDisabled={isStarting}
          onChange={onRouting}
        />
        <div className="flex min-w-0 flex-col items-end gap-1">
          <div className="flex min-w-0 items-center gap-2">
            {error === null ? null : (
              <span
                role="alert"
                className="inline-flex min-w-0 items-start gap-1 text-label text-danger"
              >
                <AlertTriangle size={ICON_SIZE.row} className="mt-0.5 shrink-0" aria-hidden />
                {error}
              </span>
            )}
            {isDiscardArmed ? (
              <InlineConfirm
                role="danger"
                icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
                title="Discard this brief?"
                description="Back keeps it. Cancel throws it away."
                confirmLabel="Discard"
                onConfirm={onDiscard}
                onCancel={onDisarmDiscard}
              />
            ) : (
              <Button
                variant="ghost"
                size="md"
                onClick={hasDraft ? onArmDiscard : onCancel}
                disabled={isStarting}
              >
                Cancel
              </Button>
            )}
            <Button
              size="md"
              data-testid="artifact-generate"
              onClick={onGenerate}
              disabled={gate.isDisabled}
              {...(gate.reason === null ? {} : { 'aria-describedby': GENERATE_REASON_ID })}
              className="shrink-0"
            >
              <span className={cn(isStarting && 'text-shimmer')}>
                {isStarting ? 'Starting…' : generateLabel}
              </span>
            </Button>
          </div>
          {gate.reason === null ? null : (
            <span id={GENERATE_REASON_ID} className="text-secondary text-muted-foreground">
              {gate.reason}
            </span>
          )}
        </div>
      </div>
    </footer>
  </>
);
