// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

type Kind = 'message' | 'document';

const DESKTOP_SRC = join(__dirname, '..', '..');
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'dist', 'mocks', 'MockScene']);
const RAW_FIELD = /<(?:Textarea|textarea)\b/;
const PROMPT_FIELD = /<PromptField\b[^>]*?\bkind="(message|document)"/g;
const ANY_PROMPT_FIELD = /<PromptField\b/g;

const AGENT_COMPOSERS: Readonly<Record<string, ReadonlyArray<Kind>>> = {
  'features/chat/components/ChatInput/index.tsx': ['message'],
  'features/workspace-chat/components/ChatComposer/index.tsx': ['message'],
  'features/workflows/components/OrchestratorStrip/OrchestratorHintComposer.tsx': ['message'],
  'features/session/components/SessionKickoff/AgentStart.tsx': ['message'],
  'features/session/components/SessionKickoff/HowToWorkOnIt.tsx': ['message'],
  'features/context/components/QuestionsTab/CustomAnswerField/index.tsx': ['message'],
  'features/context/components/QuestionsTab/QuestionCard/QuestionAnswerInput.tsx': ['message'],
  'features/context/components/QuestionsTab/DelegateAnswerRow/index.tsx': ['document'],
  'features/diff/components/DiffView/CommentComposer.tsx': ['document'],
  'features/resolve/components/ReviewFlow/ReviewComment.tsx': ['document', 'document'],
  'features/resolve/ReviewLaunchStrip.tsx': ['document'],
  'features/workflows/components/WorkflowBuilderView/parts/GoalField.tsx': ['document'],
  'features/workflows/components/WorkflowBuilderView/parts/GuidanceDisclosure.tsx': ['document'],
  'features/workflows/components/WorkflowBuilderView/parts/PlannerDraftRow.tsx': ['document'],
  'features/workflows/components/StepTree/StepEditorFields.tsx': ['document', 'document'],
  'features/artifacts/components/ArtifactCreationPane/ArtifactBriefField.tsx': ['document'],
  'features/wireframes/components/WireframeViewer/ChangeComposer.tsx': ['document'],
  'features/workspace-chat/components/TurnIntoWorkPanel/index.tsx': ['document'],
  'features/session/components/AgentInstructionsField.tsx': ['document'],
  'features/explore/components/ExplorePane/ExploreSpawnPopover.tsx': ['document'],
  'features/permissions/components/PermissionRequestCard/index.tsx': ['document'],
  'features/integrations/components/LaunchSessionPanel/index.tsx': ['document'],
  'features/onboarding/OnboardingWizard/steps/FirstSessionStep.tsx': ['document'],
  'features/session/components/SessionKickoff/IssueBriefProposal/BriefEditor.tsx': ['document'],
};

const NOT_AGENT: Readonly<Record<string, string>> = {
  'shared/components/PromptField/index.tsx': 'the shared field itself',
  'shared/components/Conversation/ConversationComposer.tsx':
    'issue and MR comments, read by people',
  'features/review/components/ReviewPane/WriteReview/LineComment.tsx':
    'a review comment on GitHub, read by people',
  'features/review/components/ReviewPane/WriteReview/WriteReviewForm.tsx':
    'a review on GitHub, read by people',
  'features/integrations/github/components/PullRequest/PrOverview.tsx':
    'the pull request body, read by people',
  'features/integrations/github/components/PullRequest/CreatePrPanel.tsx':
    'the pull request body, read by people',
  'features/integrations/gitlab/MergeRequest/MrDetailPanel/CreateMrForm.tsx':
    'the merge request body, read by people',
  'features/chat/components/ChatView/SlackDraftCard.tsx': 'a Slack reply, read by people',
  'features/history/components/RewriteHistoryPage/RewordEditor.tsx': 'a commit message',
  'features/scripts/components/ScriptEditor/index.tsx': 'a shell script',
  'features/skills/components/SkillsPanel/index.tsx': 'a saved skill file',
  'features/settings/components/SettingsStudio/ReplyStyleNoteField.tsx': 'a setting',
  'features/settings/components/SettingsStudio/ReplyTemplateField.tsx': 'a setting',
  'features/artifacts/components/ArtifactShell/ArtifactDocumentShell.tsx':
    'an artifact document edited in place',
  'features/session/components/ContextDrawer/GoalTab.tsx': 'saved session context, edited in place',
  'features/session/components/ContextDrawer/BlockEditor.tsx':
    'saved session context, edited in place',
  'features/workflows/components/WorkflowBuilderView/parts/BuilderTitleField.tsx': 'a title',
  'shared/components/DescriptionSection/index.tsx': 'a description edited in place',
  'shared/components/ProfileForm/index.tsx': 'a profile form',
};

const listSources = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSources(full, acc);
      continue;
    }
    if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) {
      acc.push(full);
    }
  }
  return acc;
};

const sources = listSources(DESKTOP_SRC).map((file) => ({
  path: relative(DESKTOP_SRC, file),
  text: readFileSync(file, 'utf8'),
}));

const textFields = sources.filter(
  ({ text }) => RAW_FIELD.test(text) || (text.match(ANY_PROMPT_FIELD) ?? []).length > 0,
);

const kindsOf = (text: string): ReadonlyArray<string> =>
  [...text.matchAll(PROMPT_FIELD)].map((match) => match[1] ?? '');

describe('every composer that talks to an agent is a PromptField of its kind', () => {
  it('classifies every file that renders a text area', () => {
    const unclassified = textFields
      .map(({ path }) => path)
      .filter((path) => AGENT_COMPOSERS[path] === undefined && NOT_AGENT[path] === undefined);
    expect(unclassified).toEqual([]);
  });

  it('keeps no stale row in either list', () => {
    const present = new Set(textFields.map(({ path }) => path));
    const stale = [...Object.keys(AGENT_COMPOSERS), ...Object.keys(NOT_AGENT)].filter(
      (path) => !present.has(path),
    );
    expect(stale).toEqual([]);
  });

  it.each(Object.entries(AGENT_COMPOSERS))('%s', (path, kinds) => {
    const source = sources.find((entry) => entry.path === path);
    expect(source).toBeDefined();
    const text = source?.text ?? '';
    expect(RAW_FIELD.test(text)).toBe(false);
    expect((text.match(ANY_PROMPT_FIELD) ?? []).length).toBe(kinds.length);
    expect(kindsOf(text)).toEqual(kinds);
  });

  it('keeps the people and settings fields off the prompt field', () => {
    const offenders = Object.keys(NOT_AGENT)
      .filter((path) => path !== 'shared/components/PromptField/index.tsx')
      .filter((path) =>
        (sources.find((entry) => entry.path === path)?.text ?? '').includes('<PromptField'),
      );
    expect(offenders).toEqual([]);
  });
});
