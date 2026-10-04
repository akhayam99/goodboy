// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const FEATURES = join(__dirname, '..', '..', 'features');
const SETTINGS = join(FEATURES, 'settings');
const WORKFLOWS = join(FEATURES, 'workflows');

const OPENS_SETTINGS = /openSettings\(|goodboy:open-settings/;
const OPENS_WORKFLOW_RULES = /openWorkflowRules/;

const WORKFLOW_PANELS_THAT_OPEN_SETTINGS: ReadonlyArray<string> = [
  'components/WorkflowGuidance/AlsoSentLine.tsx',
  'components/WorkflowRulesPanel/RulesProvidersBand.tsx',
  'components/WorkflowStudio/WorkflowEditor/NoProvidersNotice.tsx',
];

const listSources = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSources(full, acc);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
};

const filesMatching = ({ root, pattern }: { readonly root: string; readonly pattern: RegExp }) =>
  listSources(root)
    .filter((file) => pattern.test(readFileSync(file, 'utf8')))
    .map((file) => relative(root, file).split('\\').join('/'))
    .sort();

describe('links between Settings and Workflows go one way', () => {
  it('no Settings file opens the workflow rules', () => {
    expect(filesMatching({ root: SETTINGS, pattern: OPENS_WORKFLOW_RULES })).toEqual([]);
  });

  it('the Workflows panels that open Settings can only shrink', () => {
    const found = filesMatching({ root: WORKFLOWS, pattern: OPENS_SETTINGS });
    const extra = found.filter((file) => !WORKFLOW_PANELS_THAT_OPEN_SETTINGS.includes(file));
    const gone = WORKFLOW_PANELS_THAT_OPEN_SETTINGS.filter((file) => !found.includes(file));
    expect(
      extra,
      'A Workflows panel must not open Settings. A page links one way, never back.',
    ).toEqual([]);
    expect(gone, 'These no longer open Settings: remove them from the list.').toEqual([]);
  });
});
