import type { ComponentType } from 'react';
import type { ProviderId } from '@goodboy/types';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';

const noop = () => undefined;

const CONNECTED = ['anthropic', 'codex', 'cursor', 'gemini'] satisfies ReadonlyArray<ProviderId>;

const RoleModelSetAddScene = () => (
  <main className="min-h-screen bg-background p-8 text-foreground">
    <section aria-label="Models for planning" className="flex w-96 flex-col gap-2">
      <span className="text-row text-foreground">Models for planning</span>
      <RoutingPicker
        presentation="inline"
        availability="setup"
        ariaLabel="Planner add model"
        connectedProviders={CONNECTED}
        provider="anthropic"
        model=""
        effort={{ editable: false, value: 'high' }}
        recommendation={{ provider: 'anthropic', model: 'claude-opus-5', effort: 'high' }}
        recommendationKind="auto"
        overridden={false}
        disabled={false}
        onChange={noop}
        commit={{ label: 'Add', onCommit: noop }}
      />
    </section>
  </main>
);

export const U23_ROLE_MODEL_SET_SCENES: Readonly<Record<string, ComponentType>> = {
  'role-model-set-add': RoleModelSetAddScene,
};
