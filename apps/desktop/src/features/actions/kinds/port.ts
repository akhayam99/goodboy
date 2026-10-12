import { EyeOff, Pin, PinOff, SquarePen } from 'lucide-react';
import type { HiddenPortSource } from '@goodboy/core';
import type { ObjectKindDefinition, PortActionTarget } from '../types';

export const PORT_EDIT_EVENT = 'goodboy:port-edit-description';

export type PortEditRequest = {
  readonly port: number;
};

export type PortLayer = 'pinned' | HiddenPortSource;

export type PortFacts = {
  readonly port: number;
  readonly layer: PortLayer;
  readonly description: string;
};

type FactsParams = {
  readonly facts: PortFacts;
};

const isPinned = ({ facts }: FactsParams): boolean => facts.layer === 'pinned';

export const PORT_KIND: ObjectKindDefinition<PortActionTarget, PortFacts> = {
  noun: 'port',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'port.pin',
      label: 'Pin',
      icon: Pin,
      group: 'act',
      when: ({ facts }) => !isPinned({ facts }),
      run: async ({ facts, env }) => {
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
        await env.getState().unpinPort({ port: facts.port });
      },
    },
    {
      id: 'port.hide',
      label: 'Hide',
      icon: EyeOff,
      group: 'act',
      isUndoable: true,
      when: ({ facts }) => !isPinned({ facts }),
      run: async ({ facts, env }) => {
        if (facts.layer === 'pinned') {
          return;
        }
        await env.getState().hidePort({ port: facts.port, source: facts.layer });
      },
    },
  ],
};
