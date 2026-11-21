import { NAMES } from '../../shared/utils/names';
import { ITEM_WORK_WORDS } from '../../features/live-state/itemWork/itemWorkWords';
import type { RetiredName } from './RetiredName';

type ModuleParams = {
  readonly path: string;
  readonly module: Readonly<Record<string, unknown>>;
};

const isRetiredName = (value: unknown): value is RetiredName =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  typeof value.id === 'string' &&
  'pattern' in value &&
  value.pattern instanceof RegExp &&
  'use' in value &&
  typeof value.use === 'string';

const retiredNamesIn = ({ path, module }: ModuleParams): ReadonlyArray<RetiredName> =>
  Object.values(module).flatMap((exported) => {
    if (!Array.isArray(exported) || !exported.every(isRetiredName)) {
      throw new Error(`${path} exports something that is not a list of retired names`);
    }
    return exported;
  });

const FROM_UNITS: ReadonlyArray<RetiredName> = Object.entries(
  import.meta.glob<Readonly<Record<string, unknown>>>('./retired/*.ts', { eager: true }),
).flatMap(([path, module]) => retiredNamesIn({ path, module }));

const SHARED: ReadonlyArray<RetiredName> = [
  { id: 'cancel-turn', pattern: /\bCancel turn\b/i, use: NAMES.stop },
  { id: 'verbose', pattern: /\bVerbose\b/, use: NAMES.long },
  { id: 'spend-limit', pattern: /\b[Ss]pend limit\b/i, use: NAMES.spendCap },
  { id: 'spend-cap', pattern: /\bspend cap\b/i, use: NAMES.spendCap },
  { id: 'spend-caps', pattern: /\bspend caps\b/i, use: NAMES.spendCaps },
  { id: 'budget-rules', pattern: /\b[Bb]udget rules\b/i, use: NAMES.spendCaps },
  { id: 'copy-as-brief', pattern: /\bCopy as brief\b/i, use: NAMES.copyContext },
  { id: 'budget-cap', pattern: /\b[Bb]udget cap\b/i, use: NAMES.spendCap },
  { id: 'link-plain-folder', pattern: /\bLink a plain folder\b/i, use: NAMES.addPlainFolder },
  { id: 'provider-limits', pattern: /\b(?:More )?[Pp]rovider limits\b/, use: NAMES.usage },
  { id: 'add-folder', pattern: /\bAdd folder\b/, use: NAMES.addProject },
  { id: 'folders-noun', pattern: /^Folders$/, use: NAMES.projects },
  {
    id: 'waiting-for-you-title',
    pattern: /^(?:Waiting for you|Waits on you|Waiting for your (?:OK|answer))$/,
    use: NAMES.needsYou,
  },
  { id: 'approve-plan', pattern: /\bApprove plan\b/, use: NAMES.approveAndContinue },
  { id: 'change-approach', pattern: /\bChange approach\b/, use: NAMES.stop },
  { id: 'dev-project', pattern: /\b[Dd]ev project\b/, use: NAMES.gitRepository },
  { id: 'link-existing', pattern: /\bLink existing\b/i, use: NAMES.addExisting },
  {
    id: 'link-integration',
    pattern: /\bLink (?:your first )?integration\b/,
    use: NAMES.connectIntegration,
  },
  { id: 'command-palette', pattern: /\bCommand palette\b/i, use: NAMES.searchOrRun },
  { id: 'open-as-page', pattern: /\bOpen as page\b/, use: NAMES.openFullPage },
  {
    id: 'beside-the-session',
    pattern: /^(?:Dock (?:the \w+ )?)?[Bb]eside the session$/,
    use: NAMES.dockBesideThePage,
  },
  { id: 'autorun', pattern: /\bAutorun\b/i, use: NAMES.asksYou },
  { id: 'run-on-its-own', pattern: /\bRun on its own\b/i, use: NAMES.asksYou },
  { id: 'autopilot', pattern: /\bAutopilot\b/, use: NAMES.asksYou },
  { id: 'ask-before-each-step', pattern: /\bAsk before each step\b/i, use: NAMES.everyStep },
  { id: 'ask-after-the-plan', pattern: /\bAsk after the plan\b/i, use: NAMES.afterThePlan },
  { id: 'when-to-ask', pattern: /\bWhen to ask\b/i, use: NAMES.asksYou },
  { id: 'autonomy', pattern: /\bAutonomy\b/, use: NAMES.asksYou },
  {
    id: 'ask-me',
    pattern: /^Ask me$|\bAsk me\b(?! anything| first| before)/,
    use: NAMES.everyStep,
  },
  { id: 'balanced', pattern: /^Balanced$/, use: NAMES.afterThePlan },
  {
    id: 'autopilot-agent',
    pattern: /\bAutopilot (?:agent|mode)\b|\bAuto mode\b/,
    use: NAMES.asksYou,
  },
  {
    id: 'waiting-on-you',
    pattern: /\bWaiting on (?:you\b(?! is not counted)|your answer)/,
    use: NAMES.needsYou,
  },
  {
    id: 'resolve-after-replying',
    pattern: /\bResolve the thread after replying\b/,
    use: NAMES.resolveTheThread,
  },
  {
    id: 'mark-thread-resolved',
    pattern: /\bMark thread as resolved\b/,
    use: NAMES.resolveTheThread,
  },
  { id: 'attribution-line', pattern: /\bAttribution line\b/, use: NAMES.signReplies },
  {
    id: 'edit-posted-reply',
    pattern: /\bEdit the posted reply\b/,
    use: NAMES.updateReplyAfterSquash,
  },
  { id: 'with-a-session', pattern: /\bWith a session\b/, use: NAMES.hasASession },
  { id: 'standing-guidance', pattern: /\bStanding guidance\b/i, use: NAMES.guidance },
  { id: 'close-workflow', pattern: /\bClose (?:this )?workflow\b(?!s)/i, use: NAMES.stopRun },
  {
    id: 'discard-workflow',
    pattern: /\bDiscard workflow\b(?! draft)/,
    use: NAMES.archiveRun,
  },
  { id: 'stop-workflow', pattern: /\bStop (?:this )?workflow\b(?!s)/i, use: NAMES.stopRun },
  {
    id: 'archive-workflow',
    pattern: /\bArchive (?:this )?workflow\b(?!s)/i,
    use: NAMES.archiveRun,
  },
  { id: 'delete-workflow-run', pattern: /\bDelete workflow run\b/i, use: NAMES.deleteRun },
  {
    id: 'start-workflow-run',
    pattern: /\b(?:Run (?:a )?workflow|Start a workflow|Attach another workflow)\b/,
    use: NAMES.startRun,
  },
  { id: 'workflow-runs', pattern: /\bWorkflow runs\b/i, use: NAMES.runs },
  {
    id: 'detach-project',
    pattern: /\bDetach(?:ed)? (?:project|and|a project|details)\b/,
    use: NAMES.removeFromSession,
  },
  {
    id: 'wipe-local-database',
    pattern: /\bWipe (?:local database|every workspace)\b|\bLocal data wiped\b/,
    use: NAMES.deleteAllData,
  },
  { id: 'send-message', pattern: /\bSend message\b/, use: NAMES.send },
  { id: 'try-again', pattern: /^Try again(?: on [\w .-]+| with the hint)?$/, use: NAMES.retry },
  { id: 'your-roles', pattern: /\bYour roles\b/i, use: NAMES.yourJob },
  { id: 'pair-device', pattern: /\bPair (?:a |another )?device\b/, use: NAMES.pairIphone },
  { id: 'sign-out-label', pattern: /^Sign out$/, use: NAMES.disconnect },
  { id: 'rewrite-history', pattern: /\bRewrite history\b/i, use: NAMES.editCommits },
  { id: 'open-review', pattern: /\bOpen Review\b(?! replies)/, use: NAMES.comments },
  { id: 'open-diff', pattern: /\bOpen diff\b/i, use: NAMES.changes },
  { id: 'files-tab', pattern: /\bOpen (?:in )?files\b|\bFiles tab\b/i, use: NAMES.changes },
  { id: 'review-diff-view', pattern: /\b[Ii]n the (?:Review|Diff) view\b/, use: NAMES.comments },
  { id: 'rebase-in-the-diff', pattern: /\bRebase in the Diff\b/, use: NAMES.branch },
  { id: 'in-review-page', pattern: /\bin Review\b(?! replies)/, use: NAMES.comments },
  { id: 'review-replies', pattern: /\bReview replies\b/, use: NAMES.repliesAndCommits },
  { id: 'defaults-page', pattern: /\b(?:in|then|Open) Defaults\b/, use: NAMES.models },
  { id: 'push-commits', pattern: /\bPush commits\b/, use: NAMES.push },
  { id: 'push-these', pattern: /\bPush these\b/, use: NAMES.push },
  { id: 'apply-and-resolve', pattern: /\bApply and resolve\b/, use: NAMES.applyFix },
  { id: 'fix-to-review', pattern: /\bFix to review\b/, use: NAMES.fixReady },
  { id: 'online-copy', pattern: /\bonline copy\b/i, use: NAMES.onOrigin },
  {
    id: 'let-agent-fix-push',
    pattern: /\bLet an agent fix the push\b/,
    use: NAMES.fixPushWithAgent,
  },
  { id: 'fix-with-agent', pattern: /\bFix with agent\b/, use: NAMES.fixPushWithAgent },
  {
    id: 'fix-proposed',
    pattern: /^Fix proposed$|\bfixes? proposed\b/i,
    use: ITEM_WORK_WORDS.state.causeFound.word,
  },
  {
    id: 'no-fix-proposed',
    pattern: /\bNo fix proposed\b/,
    use: ITEM_WORK_WORDS.state.noFixFound.word,
  },
  { id: 'fix-stopped', pattern: /\bFix stopped\b/, use: ITEM_WORK_WORDS.state.stopped.word },
  { id: 're-running', pattern: /\bRe-running\b/, use: ITEM_WORK_WORDS.state.pushedChecking.word },
  { id: 'open-the-agent', pattern: /^Open the agent(?::.*)?$/, use: NAMES.openAgent },
  {
    id: 'couldnt-fix',
    pattern: /\bcouldn['\u2019]t (?:be )?fix(?:ed)?\b/i,
    use: ITEM_WORK_WORDS.state.failed.word,
  },
  {
    id: 'history-rewriter-needs-you',
    pattern: /\bHistory rewriter needs you\b/,
    use: NAMES.rebaseNeedsYou,
  },
  { id: 'resolve-n-comments', pattern: /\bResolve \d+ comments?\b/, use: NAMES.fix },
  { id: 'fix-n-comments', pattern: /\bFix \d+ (?:open )?comments?\b/, use: NAMES.fix },
  { id: 'draft-a-fix', pattern: /\bDraft (?:a fix|fixes for)\b/, use: NAMES.fix },
  { id: 'reply-yourself', pattern: /\bReply yourself\b/i, use: NAMES.reply },
  { id: 'resolve-without-reply', pattern: /\bResolve without a reply\b/, use: NAMES.resolve },
  { id: 'post-reply-now', pattern: /\bPost reply now\b/i, use: NAMES.publishReply },
  {
    id: 'start-from-todays-main',
    pattern: /\bStart from today(?:'|&apos;)s main\b/,
    use: NAMES.rebaseOn,
  },
  { id: 'new-worktree', pattern: /\bNew worktree\b/i, use: NAMES.newBranch },
  { id: 'close-worktree', pattern: /\bClose worktree\b/i, use: NAMES.closeBranch },
  {
    id: 'waiting-for-approval',
    pattern: /\bWaiting for your approval\b/,
    use: NAMES.waitingForPermission,
  },
  {
    id: 'waiting-for-permission',
    pattern: /\bWaiting for your permission\b/,
    use: NAMES.waitingForPermission,
  },
  { id: 'lowercase-notifications', pattern: /^notifications$/, use: NAMES.notifications },
  { id: 'inbox-door', pattern: /(?<![-\w])Inbox\b(?!-)/i, use: NAMES.tasks },
  { id: 'launch-session', pattern: /\bLaunch(?:ing)? session\b/, use: NAMES.start },
  {
    id: 'pick-up-issue',
    pattern: /\bPick up (?:issue\b|[A-Z][A-Z0-9]*-\d+|#\d+)/,
    use: NAMES.pickAnIssue,
  },
  { id: 'ask-an-agent', pattern: /\bAsk an agent\b/, use: NAMES.startARun },
  { id: 'start-agent', pattern: /\bStart agent\b/, use: NAMES.startARun },
  { id: 'start-auto', pattern: /\bStart Auto\b(?! agent)/, use: NAMES.startARun },
  { id: 'start-an-auto', pattern: /\bStart an auto\b/i, use: NAMES.startARun },
  { id: 'orchestrate-verb', pattern: /^Orchestrate$/, use: NAMES.startRun },
  { id: 'start-a-run', pattern: /\bStart another run\b/, use: NAMES.startARun },
  { id: 'start-an-agent', pattern: /\bStart an agent\b/, use: NAMES.startARun },
  { id: 'run-an-orchestrator', pattern: /\bRun an orchestrator\b/, use: NAMES.startRun },
  { id: 'move-to-auto', pattern: /\bMove to Auto\b/, use: NAMES.letAutoTakeIt },
  { id: 'bring-them-in', pattern: /\bBring them in\b/, use: NAMES.rebaseOnThem },
  {
    id: 'bring-them-into-the-plan',
    pattern: /\bBring them into the plan\b/,
    use: NAMES.rebaseOnThem,
  },
  { id: 'reset-chat', pattern: /\bReset chat\b/, use: NAMES.newQuestion },
  {
    id: 'ask-the-agent-about-this',
    pattern: /\bAsk the agent about this\b/,
    use: NAMES.sendToTheAgent,
  },
  {
    id: 'turn-into-work',
    pattern: /\b(?:Turn into work|Start work from here)\b/,
    use: NAMES.startWorkFromChat,
    allowedPaths: /^(?:features\/work\/|app\/components\/MockScene\/scenes\/u42\/)/,
  },
  {
    id: 'session-is-a-task',
    pattern:
      /\b(?:[Ee]ach task (?:is a session|gets its own)|[Aa] session is one task|[Oo]ne task with one goal|Give it a first task)\b/,
    use: NAMES.session,
  },
  { id: 'write-the-task', pattern: /\bWrite the task first\b/, use: NAMES.goal },
  { id: 'describe-a-task', pattern: /\bDescribe a task\b/, use: NAMES.goal },
  { id: 'scripts-tasks-band', pattern: /\bTasks of [\w@]/, use: NAMES.commands },
  { id: 'start-on-a-task', pattern: /\bStart on a task\b/, use: NAMES.startSession },
  { id: 'stop-the-answer', pattern: /\bStop the answer\b/, use: NAMES.stop },
  { id: 'workflow-rules', pattern: /\bWorkflow rules\b/i, use: NAMES.runs },
  { id: 'run-defaults', pattern: /\bRun defaults\b/, use: NAMES.runs },
  { id: 'default-cap', pattern: /\bDefault cap\b/i, use: NAMES.spendCap },
  { id: 'provider-defaults', pattern: /\bProvider defaults\b/i, use: NAMES.models },
  { id: 'add-another-project', pattern: /\bAdd another project\b/i, use: NAMES.addProject },
  { id: 'link-a-project', pattern: /\bLink a (?:project|repository)\b/i, use: NAMES.addProject },
  { id: 'workspace-projects', pattern: /\bWorkspace projects\b/i, use: NAMES.projects },
  {
    id: 'providers-and-models-amp',
    pattern: /\bProviders & models\b/,
    use: NAMES.providers,
  },
  { id: 'providers-and-models', pattern: /\bProviders and models\b/, use: NAMES.providers },
  { id: 'pair-your-iphone', pattern: /\bPair your iPhone\b/i, use: NAMES.pairIphone },
  {
    id: 'unlink-from-session',
    pattern: /\bUnlink from (?:this )?session\b/i,
    use: NAMES.unlink,
  },
  { id: 'open-a-folder', pattern: /\bOpen a folder\b/, use: NAMES.newWorkspace },
  { id: 'start-a-new-project', pattern: /\bStart a new project\b/, use: NAMES.newWorkspace },
  { id: 'add-workspace', pattern: /\bAdd workspace\b/, use: NAMES.newWorkspace },
  {
    id: 'switch-theme-mode',
    pattern: /\bSwitch to (?:light|dark) mode\b/i,
    use: NAMES.theme,
  },
  { id: 'add-note', pattern: /\bAdd note\b/, use: NAMES.addComment },
  { id: 'note-on-line', pattern: /\bNote on (?:line|this file)\b/, use: NAMES.addComment },
  { id: 'resume-bare', pattern: /^Resume$/, use: NAMES.continue },
  { id: 'resume-run', pattern: /\bResume run\b/, use: NAMES.continue },
  { id: 'continue-the-run', pattern: /\bContinue the run\b/, use: NAMES.continue },
  { id: 'continue-step', pattern: /\bContinue step\b/, use: NAMES.continue },
  { id: 'resume-all', pattern: /\bResume all\b/, use: NAMES.continueAll },
  { id: 'view-transcript', pattern: /\bView transcript\b/, use: NAMES.openTranscript },
  { id: 'go-to-chat', pattern: /\bGo to chat\b/, use: NAMES.openAgent },
  { id: 'see-what-it-did', pattern: /\bSee what it did\b/, use: NAMES.openAgent },
  { id: 'open-fix-run', pattern: /\bOpen fix run\b/, use: NAMES.openAgent },
  { id: 'retry-through-auto', pattern: /\bRetry through Auto\b/, use: NAMES.retry },
  { id: 'restart-step', pattern: /\bRestart step\b/, use: NAMES.retryStep },
  { id: 'ask-it-to-continue', pattern: /\bAsk it to continue\b/, use: NAMES.continue },
  { id: 'skip-and-go-on', pattern: /\bSkip and go on\b/, use: NAMES.skipStep },
  { id: 'discard-request', pattern: /\bDiscard request\b/, use: NAMES.decline },
  { id: 'mark-all-seen', pattern: /\bMark all seen\b/, use: NAMES.markAsRead },
  { id: 'restore-turn', pattern: /\bRestore turn\b/, use: NAMES.undoReply },
  { id: 'undo-restore-of-turn', pattern: /\bUndo restore of turn\b/, use: NAMES.undoRestore },
  { id: 'bring-it-back', pattern: /\bBring it back\b/, use: NAMES.undoRestore },
  { id: 'waits-for-this-turn', pattern: /\bWaits for this turn\b/, use: NAMES.waitsForThisReply },
  { id: 'new-turns-start-in', pattern: /\bNew turns start in\b/, use: NAMES.startsIn },
  { id: 'the-turn-failed', pattern: /\bThe turn (?:failed|stopped)\b/, use: NAMES.failed },
  { id: 'turn-finished', pattern: /\bTurn finished\b/, use: NAMES.replyFinished },
  {
    id: 'banner-when-you-are-away',
    pattern: /\bBanner when you are away\b/,
    use: NAMES.bannerWhenAway,
  },
  { id: 'links-bare', pattern: /^Links$/, use: NAMES.linksInSession },
  { id: 'keys-from-before', pattern: /\bKeys from before 0\.15\.5\b/, use: NAMES.classicSendKeys },
  {
    id: 'show-if-a-command-passed',
    pattern: /\bShow if a command passed or failed\b/,
    use: NAMES.commandStatus,
  },
  { id: 'exit-status', pattern: /\bExit status\b/, use: NAMES.commandStatus },
  { id: 'leave-out', pattern: /^Leave out$/, use: NAMES.skipFolders },
  {
    id: 'auto-agent',
    pattern: /\bAuto agents?\b/,
    use: NAMES.lead,
  },
  {
    id: 'auto-as-the-lead',
    pattern:
      /\bAuto(?:'s answer| needs you| is (?:reading|answering|choosing|still starting|working|resolving|rebasing|not available)| tried to| asks which| asked for| couldn't| can't| has already| was stopped| decides what| resolves| resolved| resolving| works from)\b|\b(?:Detach from|Open|Resolve with|Rebased by|Returned to|Stopped by|Waiting for|Moved to|Let|Message) Auto\b|\bbefore Auto starts\b/,
    use: NAMES.lead,
  },
  {
    id: 'start-work-verb',
    pattern: /\bStart work\b(?! from (?:chat|this)\b)/,
    use: NAMES.startARun,
    allowedPaths: /^(?:features\/work\/|features\/session\/components\/StartWork\/)/,
  },
  {
    id: 'work-door',
    pattern: /^Work$/,
    use: NAMES.runs,
    allowedPaths: /^(?:features\/work\/|shared\/components\/ProfileForm\/)/,
  },
];

export const RETIRED_NAMES: ReadonlyArray<RetiredName> = [...SHARED, ...FROM_UNITS];
