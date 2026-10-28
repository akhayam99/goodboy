import { useEffect, useRef } from 'react';
import type { AgentEffort, ProviderId } from '@goodboy/types';
import { ModelControlChip } from '../../../../shared/components/ModelControlChip';
import { AUTO_RECOMMENDATION_COPY } from '../../../../shared/components/RoutingPicker/autoRecommendationCopy';
import { sceneParam } from './audit/sceneParams';

const noop = () => undefined;

type ModelRouting = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: AgentEffort;
};

const CONNECTED = [
  'anthropic',
  'codex',
  'cursor',
  'gemini',
  'copilot',
  'openrouter',
  'opencode',
  'moonshot',
] satisfies ReadonlyArray<ProviderId>;

const SUGGESTION = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  effort: 'medium',
} satisfies ModelRouting;

const PINNED = {
  provider: 'codex',
  model: 'gpt-6.1-sol',
  effort: 'high',
} satisfies ModelRouting;

export const ModelPickerAutoScene = () => {
  const frameRef = useRef<HTMLElement>(null);
  const isPinned = sceneParam({ key: 'mode' }) === 'pinned';
  useEffect(() => {
    const timer = window.setTimeout(() => {
      frameRef.current?.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')?.click();
    }, 150);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <main ref={frameRef} className="flex min-h-screen items-end bg-background p-8 text-foreground">
      <ModelControlChip
        connectedProviders={CONNECTED}
        effective={isPinned ? PINNED : SUGGESTION}
        suggestion={SUGGESTION}
        suggestionReason={AUTO_RECOMMENDATION_COPY.reason}
        recommendationKind="auto"
        isOverridden={isPinned}
        onChange={noop}
      />
    </main>
  );
};
