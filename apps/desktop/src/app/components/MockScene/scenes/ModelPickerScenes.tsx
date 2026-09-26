import { Eyebrow } from '@goodboy/ui';
import { useEffect, type ReactNode } from 'react';
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

const CURSOR_OPEN_EVENT = 'goodboy:mock-open-cursor-picker';
const CODEX_OPEN_EVENT = 'goodboy:mock-open-codex-picker';

type OpenParams = {
  readonly events: ReadonlyArray<string>;
};

const useOpenPickers = ({ events }: OpenParams): void => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const name of events) {
        window.dispatchEvent(new Event(name));
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [events]);
};

type ColumnProps = {
  readonly title: string;
  readonly hint: string;
  readonly children: ReactNode;
};

const Column = ({ title, hint, children }: ColumnProps) => (
  <section className="flex w-96 shrink-0 flex-col gap-3">
    <header className="flex flex-col gap-0.5">
      <h2 className="text-label font-semibold text-foreground">{title}</h2>
      <p className="text-secondary text-muted-foreground">{hint}</p>
    </header>
    {children}
  </section>
);

type TriggerProps = {
  readonly caption: string;
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: 'low' | 'medium' | 'high';
};

const Trigger = ({ caption, provider, model, effort }: TriggerProps) => (
  <div className="flex flex-col gap-1">
    <Eyebrow label={caption} muted />
    <RoutingPicker
      connectedProviders={CONNECTED}
      provider={provider}
      model={model}
      effort={{ editable: true, value: effort, onChange: noop }}
      disabled={false}
      ariaLabel={`${caption} routing`}
      onProvider={noop}
      onModel={noop}
    />
  </div>
);

const CURSOR_EVENTS = [CURSOR_OPEN_EVENT];
const CODEX_EVENTS = [CODEX_OPEN_EVENT];
const BOTH_EVENTS = [CURSOR_OPEN_EVENT, CODEX_OPEN_EVENT];

const CursorColumn = () => (
  <Column
    title="Cursor, one chip per family"
    hint="Gemini is a single chip, the Version row holds the numbers and Variant says Flash"
  >
    <RoutingPicker
      connectedProviders={CONNECTED}
      provider="cursor"
      model="gemini-3.8-flash-medium"
      effort={{ editable: true, value: 'medium', onChange: noop }}
      disabled={false}
      ariaLabel="Cursor routing"
      openEvent={CURSOR_OPEN_EVENT}
      onProvider={noop}
      onModel={noop}
    />
  </Column>
);

const CodexColumn = () => (
  <Column
    title="Codex, version then variant"
    hint="5.6 carries Sol, Terra and Luna, so the number is selectable on its own"
  >
    <RoutingPicker
      connectedProviders={CONNECTED}
      provider="codex"
      model="gpt-5.6-sol"
      effort={{ editable: true, value: 'high', onChange: noop }}
      disabled={false}
      ariaLabel="Codex routing"
      openEvent={CODEX_OPEN_EVENT}
      onProvider={noop}
      onModel={noop}
    />
  </Column>
);

const TriggersColumn = () => (
  <Column
    title="Closed triggers"
    hint="provider, family, version, variant, mode and effort, each said once"
  >
    <div className="flex flex-col gap-3">
      <Trigger
        caption="cursor composer"
        provider="cursor"
        model="composer-2.5-fast"
        effort="high"
      />
      <Trigger caption="codex sol" provider="codex" model="gpt-5.6-sol" effort="high" />
      <Trigger caption="codex astra" provider="codex" model="gpt-6-astra" effort="high" />
      <Trigger caption="cursor kimi" provider="cursor" model="kimi-k3-high" effort="high" />
      <Trigger caption="claude opus" provider="anthropic" model="claude-opus-5-5" effort="high" />
      <Trigger caption="cursor codex" provider="cursor" model="gpt-5.3-codex" effort="medium" />
      <Trigger caption="cursor auto" provider="cursor" model="auto" effort="medium" />
    </div>
  </Column>
);

type FrameProps = {
  readonly children: ReactNode;
};

const Frame = ({ children }: FrameProps) => (
  <main className="h-screen overflow-auto bg-background p-8 text-foreground">
    <div className="flex items-start gap-8">{children}</div>
  </main>
);

export const ModelPickerScene = () => {
  useOpenPickers({ events: BOTH_EVENTS });
  return (
    <Frame>
      <CursorColumn />
      <CodexColumn />
      <TriggersColumn />
    </Frame>
  );
};

export const ModelPickerCursorScene = () => {
  useOpenPickers({ events: CURSOR_EVENTS });
  return (
    <Frame>
      <CursorColumn />
    </Frame>
  );
};

export const ModelPickerCodexScene = () => {
  useOpenPickers({ events: CODEX_EVENTS });
  return (
    <Frame>
      <CodexColumn />
    </Frame>
  );
};

export const ModelPickerTriggersScene = () => (
  <Frame>
    <TriggersColumn />
  </Frame>
);
