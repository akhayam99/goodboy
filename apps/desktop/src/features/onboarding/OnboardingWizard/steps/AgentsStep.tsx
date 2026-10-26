import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { RotateCw } from 'lucide-react';
import {
  Button,
  FormActions,
  formatError,
  ICON_SIZE,
  KeyHint,
  Notice,
  useEscapeLayer,
} from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import type { AgentProviderId } from '../../../../store/slices/providers/probeAgent';
import { loadDefaultAgent, saveDefaultAgent } from '../defaultAgent';
import { isStepEnter } from '../stepEnter';
import { useAgentRows } from '../useAgentRows';
import { wizardCta } from '../wizardCta';
import type { WizardMode } from '../wizardSteps';
import { AgentRow } from './AgentRow';
import { ApiKeyAgents } from './ApiKeyAgents';
import { StepHeading } from './StepHeading';

type Props = {
  readonly mode: WizardMode;
  readonly isLocked: boolean;
  readonly onBack: (() => void) | null;
  readonly onDone: () => void;
  readonly setBusy: (isBusy: boolean) => void;
};

type DefaultParams = {
  readonly chosen: ProviderId | null;
  readonly saved: ProviderId | null;
  readonly ready: ReadonlyArray<ProviderId>;
};

const defaultOf = ({ chosen, saved, ready }: DefaultParams): ProviderId | null => {
  if (chosen !== null && ready.includes(chosen)) {
    return chosen;
  }
  if (saved !== null && ready.includes(saved)) {
    return saved;
  }
  return ready[0] ?? null;
};

type LeadParams = {
  readonly readyCount: number;
  readonly isChecking: boolean;
};

const leadOf = ({ readyCount, isChecking }: LeadParams): string => {
  if (isChecking) {
    return 'Checking this Mac';
  }
  return readyCount === 0
    ? 'Checks again when you come back'
    : `${readyCount} ready · checks again when you come back`;
};

export const AgentsStep = ({ mode, isLocked, onBack, onDone, setBusy }: Props) => {
  const { rows, ready, detection } = useAgentRows();
  const connectProvider = useAppStore((state) => state.connectProvider);
  const cancelProviderConnect = useAppStore((state) => state.cancelProviderConnect);
  const [saved, setSaved] = useState<ProviderId | null>(null);
  const [chosen, setChosen] = useState<ProviderId | null>(null);
  const [openId, setOpenId] = useState<AgentProviderId | null | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasonId = useId();

  useEffect(() => {
    let isDisposed = false;
    const apply = (value: ProviderId | null) => {
      if (!isDisposed) {
        setSaved(value);
      }
    };
    void loadDefaultAgent().then(apply, () => apply(null));
    return () => {
      isDisposed = true;
    };
  }, []);

  const readyCount = ready.length;
  const defaultId = defaultOf({ chosen, saved, ready });
  const isAnswered = rows.every((row) => row.state !== 'looking');
  const firstMissing = rows.find((row) => row.state === 'missing')?.id ?? null;
  const autoOpen = isAnswered && readyCount === 0 ? firstMissing : null;
  const effectiveOpen = openId === undefined ? autoOpen : openId;
  useEscapeLayer(() => setOpenId(null), effectiveOpen !== null);
  const cta = wizardCta({
    step: 'agents',
    mode,
    readyCount,
    isIssuePick: false,
    hasFailed: error !== null,
  });
  const isBlocked = isLocked || isSaving;
  const canContinue = readyCount > 0 && defaultId !== null && !isBlocked;

  const onContinue = () => {
    if (!canContinue || defaultId === null) {
      return;
    }
    setIsSaving(true);
    setBusy(true);
    setError(null);
    void saveDefaultAgent({ providerId: defaultId })
      .then(() => onDone())
      .catch((cause: unknown) => setError(formatError(cause)))
      .finally(() => {
        setIsSaving(false);
        setBusy(false);
      });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isStepEnter(event)) {
      return;
    }
    event.preventDefault();
    onContinue();
  };

  return (
    <div className="flex flex-col gap-6" onKeyDown={onKeyDown}>
      <StepHeading
        title="Your agents"
        line="Goodboy runs the coding agents already on this Mac. One ready agent is enough."
      />
      {isAnswered && readyCount === 0 && rows.every((row) => !row.isFound) ? (
        <Notice
          tone="info"
          placement="inline"
          title="No agents on this Mac yet."
          body="Install one, and the list checks again when you come back."
        />
      ) : null}
      <ul aria-label="Agents on this Mac" className="flex flex-col rounded-lg bg-fill p-1">
        {rows.map((row) => (
          <AgentRow
            key={row.id}
            row={row}
            isDefault={row.id === defaultId}
            isOpen={effectiveOpen === row.id}
            isLocked={isBlocked}
            isChecking={detection.checks[row.id].isChecking}
            onToggle={() => setOpenId(effectiveOpen === row.id ? null : row.id)}
            onMakeDefault={() => setChosen(row.id)}
            onConnect={() => void connectProvider(row.id)}
            onCancel={() => void cancelProviderConnect(row.id)}
            onCheck={() => detection.check({ providerId: row.id })}
          />
        ))}
      </ul>
      <ApiKeyAgents defaultId={defaultId} isLocked={isBlocked} onMakeDefault={setChosen} />
      <FormActions
        leading={
          <span className="flex items-center gap-2 text-meta text-faint-foreground">
            <RotateCw size={ICON_SIZE.row} aria-hidden />
            <span>{leadOf({ readyCount, isChecking: detection.isChecking })}</span>
            <Button
              size="xs"
              variant="quiet"
              disabled={detection.isChecking}
              onClick={detection.checkNow}
            >
              Check now
            </Button>
          </span>
        }
        reason={canContinue || isBlocked ? null : cta.reason}
        reasonId={reasonId}
        error={error}
      >
        {onBack === null ? null : (
          <Button
            size="md"
            variant="ghost"
            className="text-muted-foreground"
            disabled={isBlocked}
            onClick={onBack}
          >
            Back
          </Button>
        )}
        <Button
          size="md"
          variant="primary"
          disabled={!canContinue}
          isBusy={isSaving}
          aria-describedby={canContinue ? undefined : reasonId}
          onClick={onContinue}
          data-demo-anchor="setup-continue"
        >
          {cta.primary}
          <KeyHint keys={shortcutGlyphs('composer.send')} isOnTone />
        </Button>
      </FormActions>
    </div>
  );
};
