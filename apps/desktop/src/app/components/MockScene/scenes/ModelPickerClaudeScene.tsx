import { useEffect } from 'react';
import type { ProviderId } from '@goodboy/types';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';

const noop = () => undefined;

const CONNECTED = [
  'anthropic',
  'codex',
  'cursor',
  'gemini',
  'openrouter',
  'opencode',
  'moonshot',
] satisfies ReadonlyArray<ProviderId>;

const OPEN_EVENT = 'goodboy:mock-open-claude-picker';

export const ModelPickerClaudeScene = () => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new Event(OPEN_EVENT));
    }, 150);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <section className="flex w-96 shrink-0 flex-col gap-3">
        <header className="flex flex-col gap-0.5">
          <h2 className="text-heading text-foreground">Claude, family then version</h2>
          <p className="text-meta text-muted-foreground">
            Sonnet opens on 5.5, the newest version, next to 4.6 and 5
          </p>
        </header>
        <RoutingPicker
          connectedProviders={CONNECTED}
          provider="anthropic"
          model="claude-sonnet-5-5"
          effort={{ editable: true, value: 'medium', onChange: noop }}
          disabled={false}
          ariaLabel="Claude routing"
          openEvent={OPEN_EVENT}
          onProvider={noop}
          onModel={noop}
        />
      </section>
    </main>
  );
};
