// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type ArtifactId } from '@goodboy/types';
import { aPlanRow } from '../testing/autoViewFixtures';
import { readableTaskOf } from './readableTaskOf';

const PLAN_ID = '9cadae67-3b1f-4c2e-9a51-7d0e8f2b4c11';

const plan = aPlanRow({ title: 'Retry-safe credit retries' });
const PLAN = {
  ...plan,
  artifact: { ...plan.artifact, artifactId: brandId<ArtifactId>({ value: PLAN_ID }) },
};

describe('readableTaskOf', () => {
  it('names a known artifact by its title, never by its id', () => {
    expect(
      readableTaskOf({
        text: `Revise plan artifact ${PLAN_ID} with the review notes`,
        artifacts: [PLAN],
      }),
    ).toBe('Revise Retry-safe credit retries with the review notes');
  });

  it('drops an unknown id and keeps the words around it', () => {
    expect(
      readableTaskOf({
        text: `Revise plan artifact ${PLAN_ID.toUpperCase()}`,
        artifacts: [],
      }),
    ).toBe('Revise plan');
  });

  it('leaves a task with no id as written', () => {
    expect(readableTaskOf({ text: 'Add the retry test in payments-api', artifacts: [PLAN] })).toBe(
      'Add the retry test in payments-api',
    );
  });
});
