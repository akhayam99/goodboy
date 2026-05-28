// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { TranscriptItem } from '../../utils/transcript-items';
import { SkillInvocationCard } from './index';

afterEach(cleanup);

const item = {
  kind: 'skill_invocation',
  key: 'sk-1',
  skillName: 'format',
  args: ['file.ts', '--check'],
} as Extract<TranscriptItem, { kind: 'skill_invocation' }>;

describe('SkillInvocationCard', () => {
  it('renders the skill name and each argument as a chip', () => {
    render(<SkillInvocationCard item={item} />);
    expect(screen.getByText('format')).toBeDefined();
    expect(screen.getByText('file.ts')).toBeDefined();
    expect(screen.getByText('--check')).toBeDefined();
  });
});
