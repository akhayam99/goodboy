import {
  Copy,
  EyeOff,
  Pin,
  PinOff,
  Square,
  SquareArrowOutUpRight,
  SquarePen,
  Zap,
} from 'lucide-react';
import type { HiddenPortSource } from '@goodboy/core';
import { openUrl } from '../../../shared/lib/editor';
import type { StopProgress } from '../../../store/slices/monitoring/types';
import type { ActionEnv, ObjectKindDefinition, PortActionTarget } from '../types';

export const PORT_EDIT_EVENT = 'goodboy:port-edit-description';

export type PortEditRequest = {
  readonly port: number;
};

export type PortLayer = 'pinned' | HiddenPortSource;

export type PortHolder = {
  readonly pid: number | null;
  readonly name: string;
  readonly spawnId: string | null;
  readonly owner: string | null;
};

export type PortFacts = {
  readonly port: number | null;
  readonly layer: PortLayer;
  readonly description: string;
  readonly holder?: PortHolder;
};

export type PortKindFacts = PortFacts & {
  readonly stopProgress: StopProgress | null;
};

type FactsParams = {
  readonly facts: PortKindFacts;
};

type StopParams = {
  readonly facts: PortKindFacts;
  readonly env: ActionEnv;
  readonly isForced: boolean;
};

type HolderParams = {
  readonly holder: PortHolder;
};

const hasPort = ({ facts }: FactsParams): boolean => facts.port !== null;

const isPinned = ({ facts }: FactsParams): boolean =>
  hasPort({ facts }) && facts.layer === 'pinned';

const isListening = ({ facts }: FactsParams): boolean =>
  hasPort({ facts }) && facts.holder !== undefined;

const canStop = ({ facts }: FactsParams): boolean =>
  facts.holder !== undefined && facts.holder.pid !== null;

const stopBlockedReason = ({ facts }: FactsParams): string | null =>
  facts.stopProgress === 'stopping' ? 'Stopping' : null;

const whoLoses = ({ holder }: HolderParams): string =>
  holder.owner === null ? 'Anything using it stops too.' : `${holder.owner} stops with it.`;

type AddressParams = {
  readonly port: number;
};

const addressOf = ({ port }: AddressParams): string => `localhost:${port}`;

type WhereParams = {
  readonly port: number | null;
};

const whereOf = ({ port }: WhereParams): string => (port === null ? '' : ` on :${port}`);

const stop = async ({ facts, env, isForced }: StopParams): Promise<'done' | 'unchanged'> => {
  const holder = facts.holder;
  if (holder === undefined || holder.pid === null) {
    return 'unchanged';
  }
  const { pid, spawnId } = holder;
  if (!isForced && spawnId !== null) {
    await env.getState().stopGoodboyRow({ spawnId });
    return 'done';
  }
  const result = await env.getState().stopProcess({ pid, isForced });
  return result?.outcome === 'stopped' ? 'done' : 'unchanged';
};

export const PORT_KIND: ObjectKindDefinition<PortActionTarget, PortKindFacts> = {
  noun: 'port',
  facts: ({ state, target }) => {
    const pid = target.facts.holder?.pid ?? null;
    return {
      ...target.facts,
      stopProgress: pid === null ? null : (state.monitorStopping[pid] ?? null),
    };
  },
  actions: [
    {
      id: 'port.openInBrowser',
      label: 'Open in browser',
      icon: SquareArrowOutUpRight,
      group: 'open',
      when: isListening,
      run: ({ facts }) => {
        if (facts.port === null) {
          return;
        }
        return openUrl(`http://${addressOf({ port: facts.port })}`);
      },
    },
    {
      id: 'port.pin',
      label: 'Pin',
      icon: Pin,
      group: 'act',
      when: ({ facts }) => hasPort({ facts }) && !isPinned({ facts }),
      run: async ({ facts, env }) => {
        if (facts.port === null) {
          return;
        }
        await env.getState().pinPort({ port: facts.port, description: facts.description });
      },
    },
    {
      id: 'port.editDescription',
      label: 'Edit description',
      icon: SquarePen,
      group: 'act',
      when: isPinned,
      run: ({ facts }) => {
        if (facts.port === null) {
          return;
        }
        window.dispatchEvent(
          new CustomEvent<PortEditRequest>(PORT_EDIT_EVENT, { detail: { port: facts.port } }),
        );
      },
    },
    {
      id: 'port.unpin',
      label: 'Unpin',
      icon: PinOff,
      group: 'act',
      isUndoable: true,
      when: isPinned,
      run: async ({ facts, env }) => {
        if (facts.port === null) {
          return;
        }
        await env.getState().unpinPort({ port: facts.port });
      },
    },
    {
      id: 'port.stop',
      label: 'Stop',
      icon: Square,
      group: 'act',
      slot: () => 'hover',
      pendingLabel: () => 'Stopping',
      doneLabel: () => 'Stopped',
      when: ({ facts }) => canStop({ facts }) && facts.stopProgress !== 'still-running',
      blockedReason: stopBlockedReason,
      confirm: ({ facts }) =>
        facts.holder === undefined
          ? null
          : {
              title: `Stop ${facts.holder.name}${whereOf({ port: facts.port })}?`,
              description: whoLoses({ holder: facts.holder }),
              confirmLabel: 'Stop',
              role: 'alert',
            },
      run: ({ facts, env }) => stop({ facts, env, isForced: false }),
    },
    {
      id: 'port.forceStop',
      label: 'Force stop',
      icon: Zap,
      group: 'act',
      pendingLabel: () => 'Stopping',
      doneLabel: () => 'Stopped',
      description: ({ facts }) =>
        facts.stopProgress === 'still-running' ? 'It did not stop on its own' : null,
      when: canStop,
      blockedReason: stopBlockedReason,
      confirm: ({ facts }) =>
        facts.holder === undefined
          ? null
          : {
              title: `Force stop ${facts.holder.name}${whereOf({ port: facts.port })}?`,
              description: `Ends it at once, without letting it save or clean up. ${whoLoses({ holder: facts.holder })}`,
              confirmLabel: 'Force stop',
              role: 'danger',
            },
      run: ({ facts, env }) => stop({ facts, env, isForced: true }),
    },
    {
      id: 'port.hide',
      label: 'Hide',
      icon: EyeOff,
      group: 'act',
      isUndoable: true,
      when: ({ facts }) => hasPort({ facts }) && !isPinned({ facts }),
      run: async ({ facts, env }) => {
        if (facts.layer === 'pinned' || facts.port === null) {
          return;
        }
        await env.getState().hidePort({ port: facts.port, source: facts.layer });
      },
    },
    {
      id: 'port.copyAddress',
      label: 'Copy address',
      icon: Copy,
      group: 'copy',
      when: isListening,
      run: ({ facts, env }) => {
        if (facts.port === null) {
          return;
        }
        return env.copyText({ text: addressOf({ port: facts.port }) });
      },
    },
  ],
};
