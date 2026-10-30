import { useRef } from 'react';
import { Copy, Square } from 'lucide-react';
import { ContextMenu, ICON_SIZE } from '@goodboy/ui';
import { AsksYouChip } from '../../../../../../features/workflows/AsksYouChip';
import { RUN_AUTONOMY_HEADER } from '../../../../../../features/workflows/runAutonomy';
import { QuickActionsPopover } from '../../../../../../features/quick-actions/QuickActionsPopover';
import { ModelControlChip } from '../../../../../../shared/components/ModelControlChip';
import { useOpenTriggers } from '../useOpenTriggers';

const ROUTE = { provider: 'anthropic', model: 'opus', effort: 'high' } as const;

const WORDS = { value: 'Ask me', source: 'this run', chain: 'This run, then the workspace' };

const noop = () => undefined;

const SUGGESTIONS = [
  { id: 'review', label: 'Review the diff', sublabel: 'payments-api', group: 'action' },
  { id: 'retry', label: 'Retry the failed step', sublabel: 'ledger-core', group: 'action' },
  { id: 'notes', label: 'Write the release notes', sublabel: 'notify-relay', group: 'action' },
] as const;

export const PopoversStage = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  useOpenTriggers({ rootRef });

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
      <ContextMenu
        label="Agent actions"
        point={{ x: window.innerWidth - 24, y: window.innerHeight / 2 }}
        entries={[
          { kind: 'item', key: 'open', label: 'Open the agent', onSelect: noop },
          { kind: 'item', key: 'copy', label: 'Copy the link', icon: Copy, onSelect: noop },
          { kind: 'separator', key: 'divider' },
          {
            kind: 'item',
            key: 'stop',
            label: 'Stop this agent',
            isDestructive: true,
            onSelect: noop,
          },
        ]}
        onClose={noop}
      />
    </div>
  );
};
