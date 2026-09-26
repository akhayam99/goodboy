import { describe, expect, it } from 'vitest';
import { readWireframeImport } from './importWireframeJson';

const spec = {
  $schema: './wireframe.schema.json',
  version: 2,
  initialScreenId: 'welcome',
  device: 'phone',
  theme: { name: 'generic' },
  screens: [
    {
      id: 'welcome',
      title: 'Welcome',
      root: { id: 'root', kind: 'text', text: 'Welcome to Cascadia', width: 320 },
    },
  ],
  transitions: [],
};

describe('readWireframeImport', () => {
  it('reads a spec made outside, with what the validator adjusted', () => {
    const read = readWireframeImport({
      fileName: 'cascadia-onboarding.json',
      text: JSON.stringify(spec),
    });
    expect(read).toMatchObject({
      status: 'ready',
      title: 'Cascadia onboarding',
      fidelity: 'low',
      screenCount: 1,
      device: 'phone',
      version: 2,
    });
    if (read.status !== 'ready') {
      throw new Error('expected a ready import');
    }
    expect(read.adjustments.join('\n')).toContain('screens[0].root.width');
    expect(JSON.parse(read.sourceText).$schema).toBeUndefined();
  });

  it('refuses a file that is not JSON or not a wireframe', () => {
    expect(readWireframeImport({ fileName: 'x.json', text: '{' })).toMatchObject({
      status: 'invalid',
      issues: [{ message: 'the file is not valid JSON' }],
    });
    expect(readWireframeImport({ fileName: 'x.json', text: '{"version":2}' }).status).toBe(
      'invalid',
    );
  });
});
