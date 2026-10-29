// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { agentRoutingOfPin, orchestratorRoutingOfPin } from './runModelPin';
import {
  AUTO_AGENT_SLOT,
  ORCHESTRATOR_SLOT,
  runModelSlotKeyOf,
  runModelSlotOf,
  runModelSlotOfShape,
} from './runModelSlotOf';
import { runRouteOf, type RunRouteFacts } from './runRouteOf';

const FACTS: RunRouteFacts = {
  text: '',
  presets: [],
  roles: [{ kind: 'scout', label: 'Scout' }],
  lastPresetId: null,
  defaultShape: 'auto',
  hasTask: false,
  mountCount: 1,
  pullRequest: null,
  fileCount: 0,
};

type TextParams = {
  readonly text: string;
};

const routeOf = ({ text }: TextParams) => runRouteOf({ facts: { ...FACTS, text } });

describe('runModelSlotOf', () => {
  it('puts a plan on the orchestrator', () => {
    expect(runModelSlotOf({ result: routeOf({ text: 'center every member page' }) })).toEqual(
      ORCHESTRATOR_SLOT,
    );
  });

  it('puts a question on the Auto agent', () => {
    expect(
      runModelSlotOf({ result: routeOf({ text: 'Which notify-relay handler fires twice?' }) }),
    ).toEqual(AUTO_AGENT_SLOT);
  });

  it('puts a named role on that role', () => {
    expect(runModelSlotOf({ result: routeOf({ text: '@Scout list the pages' }) })).toEqual({
      kind: 'agent',
      agentKind: 'scout',
    });
  });

  it('maps the shapes of the New session page to the same slots', () => {
    expect(runModelSlotOfShape({ shape: 'orchestrated', agentKind: 'scout' })).toEqual(
      ORCHESTRATOR_SLOT,
    );
    expect(runModelSlotOfShape({ shape: 'preset', agentKind: 'scout' })).toEqual(ORCHESTRATOR_SLOT);
    expect(runModelSlotOfShape({ shape: 'autoAgent', agentKind: 'scout' })).toEqual(
      AUTO_AGENT_SLOT,
    );
    expect(runModelSlotOfShape({ shape: 'agent', agentKind: 'scout' })).toEqual({
      kind: 'agent',
      agentKind: 'scout',
    });
  });

  it('keys each slot apart', () => {
    const keys = [
      ORCHESTRATOR_SLOT,
      AUTO_AGENT_SLOT,
      { kind: 'agent' as const, agentKind: 'scout' as const },
    ].map((slot) => runModelSlotKeyOf({ slot }));
    expect(new Set(keys).size).toBe(3);
  });
});

describe('runModelPin', () => {
  const pin = { provider: 'anthropic', model: 'claude-opus-5-5', effort: 'high' } as const;

  it('hands the Auto agent the pin as its routing', () => {
    expect(agentRoutingOfPin({ pin })).toEqual({
      provider: 'anthropic',
      model: 'claude-opus-5-5',
      effort: 'high',
    });
  });

  it('hands the orchestrator the pin in the provider scoped shape', () => {
    expect(orchestratorRoutingOfPin({ pin })).toMatchObject({
      providerId: 'anthropic',
      effort: 'high',
    });
  });
});
