import { describe, expect, it } from 'vitest';
import { describeArtifactStatus } from './artifact-status';

describe('describeArtifactStatus', () => {
  it('shows no chip on a report or wireframe at rest, the node already says it', () => {
    expect(describeArtifactStatus({ kind: 'report', status: 'active' })).toBeNull();
    expect(describeArtifactStatus({ kind: 'wireframe', status: 'consumed' })).toBeNull();
  });

  it('names a replaced report without borrowing a tone', () => {
    const replaced = describeArtifactStatus({ kind: 'report', status: 'superseded' });
    expect(replaced?.label).toBe('Replaced');
    expect(replaced?.tone).toBe('neutral');
  });

  it('reads a plan with the plan vocabulary', () => {
    expect(describeArtifactStatus({ kind: 'plan', status: 'active' })?.label).toBe('Ready to run');
  });
});
