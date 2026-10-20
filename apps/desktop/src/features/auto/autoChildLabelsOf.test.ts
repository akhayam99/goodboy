import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { aDelegation } from './testing/autoViewFixtures';
import { autoChildLabelsOf } from './autoChildLabelsOf';

type ChildParams = {
  readonly key: string;
  readonly role: string;
  readonly createdAt: number;
  readonly isAdopted?: boolean;
  readonly request?: Readonly<Record<string, unknown>>;
};

const child = ({ key, role, createdAt, isAdopted = false, request = {} }: ChildParams) => ({
  ...aDelegation({ key, role, state: 'settled', outcome: 'completed' }),
  createdAt,
  isAdopted,
  request,
});

const agent = (key: string) => brandId<AgentId>({ value: `agent-${key}` });

describe('autoChildLabelsOf', () => {
  it('numbers the agents of a role in the order Auto started them, only when there are two or more', () => {
    const labels = autoChildLabelsOf({
      delegations: [
        child({ key: 'second-review', role: 'reviewer', createdAt: 20 }),
        child({ key: 'first-review', role: 'reviewer', createdAt: 10 }),
        child({ key: 'impl', role: 'implementer', createdAt: 5 }),
      ],
    });

    expect(labels.get(agent('first-review'))).toBe('Reviewer 1');
    expect(labels.get(agent('second-review'))).toBe('Reviewer 2');
    expect(labels.get(agent('impl'))).toBe('Implementer');
  });

  it('keeps the number of a child across its later delegations', () => {
    const revise = {
      ...child({ key: 'first-review', role: 'reviewer', createdAt: 30 }),
      id: brandId({ value: 'delegation-first-review-again' }),
    };
    const labels = autoChildLabelsOf({
      delegations: [
        child({ key: 'first-review', role: 'reviewer', createdAt: 10 }),
        child({ key: 'second-review', role: 'reviewer', createdAt: 20 }),
        revise,
      ],
    });

    expect(labels.get(agent('first-review'))).toBe('Reviewer 1');
    expect(labels.get(agent('second-review'))).toBe('Reviewer 2');
  });

  it('names an adopted agent by its role and leaves it out of the numbers', () => {
    const labels = autoChildLabelsOf({
      delegations: [
        child({ key: 'moved', role: 'implementer', createdAt: 1, isAdopted: true }),
        child({ key: 'impl', role: 'implementer', createdAt: 5 }),
      ],
    });

    expect(labels.get(agent('moved'))).toBe('Implementer');
    expect(labels.get(agent('impl'))).toBe('Implementer');
  });

  it('names a child by its title, then the first sentence of its task, then its role', () => {
    const labels = autoChildLabelsOf({
      delegations: [
        child({
          key: 'titled',
          role: 'scout',
          createdAt: 1,
          request: { title: 'Find the payments-api retry cap', task: 'Read the code. Report.' },
        }),
        child({
          key: 'tasked',
          role: 'implementer',
          createdAt: 2,
          request: { task: '## Goal\nRaise the ledger-core retry cap to five. Then run tests.' },
        }),
        child({ key: 'old', role: 'reviewer', createdAt: 3 }),
        child({ key: 'older', role: 'reviewer', createdAt: 4, request: { title: '  ' } }),
      ],
    });

    expect(labels.get(agent('titled'))).toBe('Find the payments-api retry cap');
    expect(labels.get(agent('tasked'))).toBe('Raise the ledger-core retry cap to five');
    expect(labels.get(agent('old'))).toBe('Reviewer 1');
    expect(labels.get(agent('older'))).toBe('Reviewer 2');
  });
});
