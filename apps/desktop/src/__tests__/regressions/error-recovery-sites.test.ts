// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { productSources } from './scanControls';

type Site = {
  readonly file: string;
  readonly title: string;
};

const SRC = 'apps/desktop/src/';

const SITES: ReadonlyArray<Site> = [
  {
    file: 'features/settings/components/SettingsStudio/OpenWithBand.tsx',
    title: "Couldn't save the default editor",
  },
  {
    file: 'features/settings/components/SettingsStudio/OpenWithBand.tsx',
    title: "Couldn't save the default browser",
  },
  {
    file: 'features/settings/components/SettingsStudio/OpenWithBand.tsx',
    title: "Couldn't save the default terminal app",
  },
  {
    file: 'features/settings/components/SettingsStudio/ClassicComposerKeysField.tsx',
    title: "Couldn't save the composer keys",
  },
  {
    file: 'features/settings/components/SettingsStudio/RunDefaultRow.tsx',
    title: "Couldn't save how new runs start",
  },
  {
    file: 'features/settings/components/SettingsStudio/WorkspaceTerminalFolderRow.tsx',
    title: "Couldn't save the terminal folder",
  },
  {
    file: 'features/settings/components/SettingsStudio/WorkspaceAfterMergeSection.tsx',
    title: "Couldn't save what happens after a merge",
  },
  {
    file: 'features/settings/components/SettingsStudio/BranchTemplateField/index.tsx',
    title: "Couldn't save the branch name",
  },
  {
    file: 'features/settings/components/SettingsStudio/useShortcutRecorder/index.ts',
    title: "Couldn't save the shortcut",
  },
  {
    file: 'features/settings/components/SettingsStudio/WorkspaceProfileSection.tsx',
    title: "Couldn't save what agents know about you",
  },
  {
    file: 'features/settings/components/SettingsStudio/WorkspaceDefaultsGrid.tsx',
    title: "Couldn't save the branch prefix",
  },
  {
    file: 'features/settings/components/SettingsStudio/RepoCheckBand.tsx',
    title: "Couldn't save how often to check the repositories",
  },
  {
    file: 'features/providers/hooks/useSpreadByHeadroom/index.ts',
    title: "Couldn't save the run defaults",
  },
  {
    file: 'features/providers/hooks/useOrchestratorModelPick/index.ts',
    title: "Couldn't save the run defaults",
  },
  {
    file: 'features/workflows/components/WorkflowRulesPanel/index.tsx',
    title: "Couldn't save the run defaults",
  },
  { file: 'store/slices/turn/settleTurn.ts', title: "Couldn't push the fix." },
  { file: 'store/slices/history/settleBranchPushFix.ts', title: "Couldn't push the fix." },
  { file: 'features/branch/hooks/useCheckFixPush/index.ts', title: "Couldn't push the branch" },
  { file: 'shared/lib/editorSettings.ts', title: "Couldn't open the editor" },
  { file: 'shared/lib/terminalApp.ts', title: "Couldn't open your terminal app" },
  { file: 'features/workspace/components/RepoEntry/RepoEntryPanel.tsx', title: 'in the editor' },
  {
    file: 'shared/components/ProjectLinkList/ProjectRowEditor.tsx',
    title: "Couldn't open ${project.name}",
  },
  {
    file: 'shared/components/ProjectLinkList/ProjectDescriptionField.tsx',
    title: "Couldn't save the description of",
  },
  {
    file: 'shared/components/ProjectLinkList/ProjectStarToggle.tsx',
    title: "Couldn't update ${project.name}",
  },
  {
    file: 'features/integrations/bitbucket/BitbucketStudio/PrDetailPanel/usePrActions.ts',
    title: "Couldn't update pull request",
  },
  {
    file: 'features/integrations/linear/LinearIssueDetail/index.tsx',
    title: "Couldn't change the status",
  },
  {
    file: 'features/integrations/linear/LinearIssueDetail/index.tsx',
    title: "Couldn't change the assignee",
  },
  { file: 'store/slices/agents/spawnAgent.ts', title: 'title: NO_ALLOWED_MODEL_TITLE' },
];

type CallParams = {
  readonly text: string;
  readonly title: string;
};

const callsNaming = ({ text, title }: CallParams): ReadonlyArray<string> => {
  const calls = new Map<number, string>();
  let from = text.indexOf(title);
  while (from !== -1) {
    const start = text.lastIndexOf('reportError(', from);
    let depth = 0;
    let end = start;
    for (let index = text.indexOf('(', start); index < text.length; index += 1) {
      depth += text[index] === '(' ? 1 : 0;
      depth -= text[index] === ')' ? 1 : 0;
      if (depth === 0) {
        end = index;
        break;
      }
    }
    calls.set(start, text.slice(start, end + 1));
    from = text.indexOf(title, from + title.length);
  }
  return [...calls.values()];
};

describe('the reported errors of the most used actions name their way out', () => {
  const sources = new Map(productSources().map(({ path, text }) => [path, text]));

  it.each(SITES)('$file says what to do or what was kept: $title', ({ file, title }) => {
    const text = sources.get(`${SRC}${file}`);
    expect(text).toBeDefined();
    const calls = callsNaming({ text: text ?? '', title });
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).toMatch(/recovery|pushFailureReportOf/);
    }
  });

  it('covers thirty call sites', () => {
    const total = SITES.reduce(
      (sum, { file, title }) =>
        sum + callsNaming({ text: sources.get(`${SRC}${file}`) ?? '', title }).length,
      0,
    );
    expect(total).toBe(30);
  });
});
