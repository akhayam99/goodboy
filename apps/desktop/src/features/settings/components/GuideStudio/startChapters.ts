import type { GuideChapter } from './guideChapters';
import { NAMES } from '../../../../shared/utils/names';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';

export const START_CHAPTERS: ReadonlyArray<GuideChapter> = [
  {
    id: 'overview',
    group: 'start',
    title: 'What is Goodboy',
    lead: 'A desk for running coding agents side by side. Each session has one goal, with its own agents, branches and history.',
    note: {
      term: "Goodboy runs each provider's own CLI",
      desc: 'It runs each CLI as a subprocess and streams its events, so your sign in, usage and plan stay inside it. Goodboy adds the workspace, the board and the orchestration.',
    },
    points: [
      {
        term: 'Setup',
        desc: `The first launch walks through Agents, Workspace, Tools and First session, and Tools can wait. Home lists your workspaces under New workspace, ${shortcutGlyphs('home.newWorkspace')}, and offers Resume setup until you have one.`,
      },
      {
        term: 'This Guide',
        desc: 'One chapter per page. Search the rail, press Enter to land on a point. The Guide opens from the Goodboy row, Help in the menu bar or the palette.',
      },
    ],
    links: [],
  },
  {
    id: 'words',
    group: 'start',
    title: 'Words',
    lead: 'The words Goodboy uses, one sentence each.',
    points: [
      {
        term: 'Workspace',
        desc: 'Where you work, named after what you work on, with your folders, connected tools and sessions.',
      },
      {
        term: 'Folder',
        desc: 'One repository or plain folder in a workspace, with its own scripts and settings.',
      },
      {
        term: 'Session',
        desc: 'One goal with its own agents, limit and notes, moving across the board until it is done.',
      },
      {
        term: 'Agent',
        desc: 'One chat in a session with its own provider and model; every session has at least one.',
      },
      {
        term: 'Run',
        desc: 'One go at a goal inside a session.',
      },
      {
        term: 'Plan',
        desc: 'The steps an agent writes before it builds.',
      },
      {
        term: 'Preset',
        desc: 'A saved workflow that a run follows.',
      },
      {
        term: 'Auto',
        desc: 'The agent that picks how a run goes.',
      },
      {
        term: 'Scout',
        desc: 'A role that reads the code and changes nothing.',
      },
      {
        term: 'Turn',
        desc: 'One message from you and the answer, which adds to what the model reads.',
      },
      {
        term: 'Worktree and branch',
        desc: 'A copy of a folder on its own branch, named gb- and six characters, so a session never touches your checkout.',
      },
      {
        term: NAMES.spendCap,
        desc: 'The most a session, a run or a provider may spend, with a warning near it.',
      },
    ],
    links: [],
  },
];
