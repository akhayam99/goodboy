import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { extractIconPath } from './brand-assets/readers/extractIconPath.mjs';

const icon = ({ paths }) =>
  `export const Mark: LucideIcon = forwardRef(() => (<svg>${paths}</svg>));\nMark.displayName = 'Mark';`;

describe('extractIconPath', () => {
  it('keeps every path of an icon', () => {
    const iconSource = icon({ paths: '<path d="M1 1Z" /><path d="M2 2Z" />' });
    assert.equal(extractIconPath({ iconSource, componentName: 'Mark' }), 'M1 1Z M2 2Z');
  });

  it('fails on an icon with no path', () => {
    assert.throws(() => extractIconPath({ iconSource: icon({ paths: '' }), componentName: 'Mark' }));
  });

  it('keeps both paths of the Copilot icon', () => {
    const iconSource = readFileSync('../packages/ui/src/components/CopilotIcon.tsx', 'utf8');
    const path = extractIconPath({ iconSource, componentName: 'CopilotIcon' });
    assert.match(path, /^M23\.922/);
    assert.match(path, / M14\.5 14\.25/);
  });
});
