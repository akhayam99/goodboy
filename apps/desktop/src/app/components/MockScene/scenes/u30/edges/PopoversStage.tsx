import { useEffect, useRef, useState } from 'react';
import { Square } from 'lucide-react';
import { brandId, type AgentId } from '@goodboy/types';
import { ICON_SIZE } from '@goodboy/ui';
import { ObjectOverflowMenu } from '../../../../../../features/actions/ObjectOverflowMenu';
import type { AgentActionTarget } from '../../../../../../features/actions/types';
import { SESSION_ID, seedActivityRunScene } from '../../activityRunSeed';
import { AsksYouChip } from '../../../../../../features/workflows/AsksYouChip';
import { RUN_AUTONOMY_HEADER } from '../../../../../../features/workflows/runAutonomy';
import { QuickActionsPopover } from '../../../../../../features/quick-actions/QuickActionsPopover';
import { ModelControlChip } from '../../../../../../shared/components/ModelControlChip';
import { useOpenTriggers } from '../useOpenTriggers';

const ROUTE = { provider: 'anthropic', model: 'opus', effort: 'high' } as const;

const WORDS = { value: 'Ask me', source: 'this run', chain: 'This run, then the workspace' };

const noop = () => undefined;

const AGENT_TARGET: AgentActionTarget = {
  kind: 'agent',
  sessionId: SESSION_ID,
  agentId: brandId<AgentId>({ value: 'mock-run-agent-planner' }),
};

const SUGGESTIONS = [
  { id: 'review', label: 'Review the diff', sublabel: 'payments-api', group: 'action' },
  { id: 'retry', label: 'Retry the failed step', sublabel: 'ledger-core', group: 'action' },
  { id: 'notes', label: 'Write the release notes', sublabel: 'notify-relay', group: 'action' },
] as const;

export const PopoversStage = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isSeeded, setIsSeeded] = useState(false);
  useEffect(() => {
    seedActivityRunScene();
    setIsSeeded(true);
  }, []);
  useOpenTriggers({ rootRef, isReady: isSeeded });

  if (!isSeeded) {
    return null;
  }
  return (
    <div ref={rootRef} data-testid="u30-popovers" className="fixed inset-0 bg-background">
      <div data-open-on-mount="" className="fixed left-2 top-2">
        <ModelControlChip
          connectedProviders={['anthropic', 'codex']}
          effective={ROUTE}
          suggestion={ROUTE}
          isOverridden={false}
          onChange={noop}
        />
      </div>
      <div data-open-on-mount="" className="fixed right-2 top-2">
        <AsksYouChip
          value="step"
          words={WORDS}
          help="When the run stops and waits for your go."
          error={null}
          isDisabled={false}
          onPick={noop}
        />
      </div>
      <div data-open-on-mount="" className="fixed bottom-2 left-2">
        <ModelControlChip
          connectedProviders={['anthropic', 'codex']}
          effective={ROUTE}
          suggestion={ROUTE}
          isOverridden={false}
          onChange={noop}
        />
      </div>
      <div data-open-on-mount="" className="fixed bottom-2 right-2">
        <AsksYouChip
          value="step"
          words={{ ...WORDS, value: RUN_AUTONOMY_HEADER }}
          help="When the run stops and waits for your go."
          error={null}
          isDisabled={false}
          onPick={noop}
        />
      </div>
      <div className="fixed bottom-16 left-1/2 w-3/5 -translate-x-1/2">
        <div className="relative flex h-14 items-center gap-2 rounded-lg border border-border-soft bg-subtle px-3 text-meta text-faint-foreground">
          <Square size={ICON_SIZE.row} aria-hidden />
          Message the agent
          <QuickActionsPopover
            items={SUGGESTIONS.map((item) => ({ ...item, perform: noop }))}
            emptyHint="Nothing matches"
            onSelect={noop}
            onDismiss={noop}
          />
        </div>
      </div>
      <div data-open-on-mount="" className="fixed right-2 top-1/2">
        <ObjectOverflowMenu target={AGENT_TARGET} label="Agent actions" align="right" />
      </div>
    </div>
  );
};
