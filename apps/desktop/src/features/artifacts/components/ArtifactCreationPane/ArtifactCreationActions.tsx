import { Trash2 } from 'lucide-react';
import { Button, cn, ConfirmPopover, FormActions, ICON_SIZE } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';

import { NAMES } from '../../../../shared/utils/names';
import type { ArtifactCreationRouting } from '../../../../store/slices/artifactDrafts/types';
import type { ArtifactCreationGate } from '../../artifactCreationGate';
import { ArtifactRoutingControl } from './ArtifactRoutingControl';

const GENERATE_REASON_ID = 'artifact-generate-reason';

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

export const ArtifactCreationActions = ({
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
  <FormActions
    leading={
      <ArtifactRoutingControl
        connectedProviders={connectedProviders}
        recommendation={recommendation}
        routing={routing}
        isDisabled={isStarting}
        onChange={onRouting}
      />
    }
    error={error}
    reason={gate.reason}
    reasonId={GENERATE_REASON_ID}
  >
    <ConfirmPopover
      role="danger"
      icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
      title="Discard this brief?"
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      isOpen={isDiscardArmed}
      onConfirm={onDiscard}
      onCancel={onDisarmDiscard}
      trigger={() => (
        <Button
          variant="ghost"
          size="sm"
          onClick={hasDraft ? onArmDiscard : onCancel}
          disabled={isStarting}
        >
          Discard
        </Button>
      )}
    />
    <Button
      size="sm"
      data-testid="artifact-generate"
      onClick={onGenerate}
      disabled={gate.isDisabled}
      {...(gate.reason === null ? {} : { 'aria-describedby': GENERATE_REASON_ID })}
      className="shrink-0"
    >
      <span className={cn(isStarting && 'text-shimmer')}>
        {isStarting ? 'Starting…' : error === null ? generateLabel : NAMES.retry}
      </span>
    </Button>
  </FormActions>
);
