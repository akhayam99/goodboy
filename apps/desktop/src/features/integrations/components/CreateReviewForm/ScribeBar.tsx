import { Check } from 'lucide-react';
import { Button, ICON_SIZE, StatusDot, Tooltip } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useNow } from '../../../../shared/hooks/useNow';
import type { AgentSpawnConfigValue } from '../../../session/agentSpawnConfigValue';
import type { ScribeJob } from './useScribeJob';

type Props = {
  readonly job: ScribeJob;
  readonly branch: string;
  readonly commitCount: number | null;
  readonly isCreating: boolean;
  readonly hasPushStep: boolean;
  readonly isPushed: boolean;
  readonly isWritten: boolean;
  readonly isDisabled: boolean;
  readonly noun: string;
  readonly routing: AgentSpawnConfigValue;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly onRoutingChange: (value: AgentSpawnConfigValue) => void;
  readonly onWrite: () => void;
  readonly onStop: () => void;
};

type ReadingParams = {
  readonly commitCount: number | null;
};

const readingWord = ({ commitCount }: ReadingParams): string => {
  if (commitCount === null || commitCount <= 0) {
    return 'Scribe is reading the commits and writing the text';
  }
  return `Scribe is reading ${commitCount} ${commitCount === 1 ? 'commit' : 'commits'} and writing the text`;
};

export const ScribeBar = ({
  job,
  branch,
  commitCount,
  isCreating,
  hasPushStep,
  isPushed,
  isWritten,
  isDisabled,
  noun,
  routing,
  connectedProviders,
  onRoutingChange,
  onWrite,
  onStop,
}: Props) => {
  const isWriting = job.status === 'writing';
  const now = useNow(1_000, isWriting);
  if (isCreating) {
    return (
      <ul
        aria-label={`Opening the ${noun}`}
        className="flex min-w-0 flex-col gap-1 text-meta text-muted-foreground"
      >
        {hasPushStep && (
          <li className="flex min-w-0 items-center gap-2">
            {isPushed ? (
              <Check size={ICON_SIZE.row} aria-hidden className="shrink-0 text-success" />
            ) : (
              <StatusDot tone="primary" size="sm" pulsing />
            )}
            <span className="min-w-0 truncate">
              {isPushed ? `Pushed ${branch}` : `Pushing ${branch}`}
            </span>
          </li>
        )}
        {(isPushed || !hasPushStep) && (
          <li className="flex min-w-0 items-center gap-2">
            <StatusDot tone="primary" size="sm" pulsing />
            <span className="min-w-0 truncate">{`Opening the ${noun}`}</span>
          </li>
        )}
      </ul>
    );
  }
  if (isWriting) {
    const seconds = Math.max(0, Math.floor((now - job.updatedAt) / 1_000));
    return (
      <div
        role="status"
        className="flex min-w-0 items-center gap-2 text-meta text-muted-foreground"
      >
        <StatusDot tone="primary" size="sm" pulsing />
        <span className="min-w-0 truncate">{readingWord({ commitCount })}</span>
        <span className="shrink-0 text-meta tabular-nums text-faint-foreground">{`${seconds}s`}</span>
        <Button variant="ghost" size="xs" onClick={onStop}>
          Stop
        </Button>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Tooltip content="Scribe writes the title and description, never code" side="top">
        <Button variant="secondary" size="sm" disabled={isDisabled} onClick={onWrite}>
          <CONCEPT_ICONS.agents size={ICON_SIZE.row} aria-hidden />
          Write with Scribe
        </Button>
      </Tooltip>
      <RoutingPicker
        variant="pill"
        ariaLabel="Scribe routing"
        connectedProviders={connectedProviders}
        provider={routing.provider}
        model={routing.model}
        effort={{ editable: true, value: routing.effort }}
        disabled={isDisabled}
        onChange={(route) => onRoutingChange({ ...routing, ...route })}
      />
      {isWritten && (
        <span className="min-w-0 truncate text-meta text-faint-foreground">
          Written by Scribe. Edit it as you like.
        </span>
      )}
    </div>
  );
};
