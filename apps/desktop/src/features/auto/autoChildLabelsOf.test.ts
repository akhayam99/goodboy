import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { aDelegation } from './testing/autoViewFixtures';
import { autoChildLabelsOf } from './autoChildLabelsOf';

type ChildParams = {
  readonly key: string;
  readonly role: string;
  readonly createdAt: number;
  readonly isAdopted?: boolean;
};

const child = ({ key, role, createdAt, isAdopted = false }: ChildParams) => ({
  ...aDelegation({ key, role, state: 'settled', outcome: 'completed' }),
  createdAt,
  isAdopted,
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
});
