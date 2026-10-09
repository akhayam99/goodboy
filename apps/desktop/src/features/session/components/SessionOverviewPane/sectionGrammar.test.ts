// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const FEATURES = join(__dirname, '..', '..', '..');

const SECTIONS = [
  { name: 'Projects', file: 'session/components/SessionOverviewPane/ProjectMountRows/index.tsx' },
  { name: 'Unassigned notes', file: 'session/components/SessionOverviewPane/UnassignedNotes.tsx' },
  { name: 'Next', file: 'suggestions/components/NextStepSlot/index.tsx' },
];

describe('the Overview section headers', () => {
  it.each(SECTIONS)('$name is a SectionHeader at heading level 2', ({ name, file }) => {
    const source = readFileSync(join(FEATURES, file), 'utf8');

    expect(source).toContain('<SectionHeader');
    expect(source).toContain(`label="${name}"`);
    expect(source).toContain('headingLevel={2}');
  });

  it.each(SECTIONS)('$name has no hand-made heading beside it', ({ file }) => {
    const source = readFileSync(join(FEATURES, file), 'utf8');

    expect(source).not.toMatch(/<h[1-6][\s>]/);
  });
});
