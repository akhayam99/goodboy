import { NAMES } from '../../shared/names';

type RetiredName = {
  readonly id: string;
  readonly pattern: RegExp;
  readonly use: string;
};

export const RETIRED_NAMES: ReadonlyArray<RetiredName> = [
  { id: 'cancel-turn', pattern: /\bCancel turn\b/, use: NAMES.stop },
  { id: 'verbose', pattern: /\bVerbose\b/, use: NAMES.long },
  { id: 'spend-limit', pattern: /\b[Ss]pend limit\b/, use: NAMES.spendCap },
  { id: 'budget-rules', pattern: /\b[Bb]udget rules\b/, use: NAMES.spendCaps },
  { id: 'copy-as-brief', pattern: /\bCopy as brief\b/, use: NAMES.copyContext },
  { id: 'budget-cap', pattern: /\b[Bb]udget cap\b/, use: NAMES.spendCap },
  { id: 'link-plain-folder', pattern: /\bLink a plain folder\b/, use: NAMES.addPlainFolder },
  { id: 'link-existing', pattern: /\bLink existing\b/, use: NAMES.addExisting },
  {
    id: 'link-integration',
    pattern: /\bLink (?:your first )?integration\b/,
    use: NAMES.connectIntegration,
  },
  { id: 'autorun', pattern: /\bAutorun\b/, use: NAMES.runOnItsOwn },
  {
    id: 'waiting-on-you',
    pattern: /\bWaiting on (?:you\b(?! is not counted)|your answer)/,
    use: NAMES.needsYou,
  },
  {
    id: 'resolve-after-replying',
    pattern: /\bResolve the thread after replying\b/,
    use: NAMES.markThreadResolved,
  },
  { id: 'with-a-session', pattern: /\bWith a session\b/, use: NAMES.hasASession },
  { id: 'standing-guidance', pattern: /\bStanding guidance\b/, use: NAMES.guidance },
  { id: 'close-workflow', pattern: /\bClose (?:this )?workflow\b(?!s)/, use: NAMES.stopRun },
  {
    id: 'discard-workflow',
    pattern: /\bDiscard workflow\b(?! draft)/,
    use: NAMES.archiveRun,
  },
  { id: 'stop-workflow', pattern: /\bStop (?:this )?workflow\b(?!s)/, use: NAMES.stopRun },
  { id: 'archive-workflow', pattern: /\bArchive (?:this )?workflow\b(?!s)/, use: NAMES.archiveRun },
  { id: 'delete-workflow-run', pattern: /\bDelete workflow run\b/, use: NAMES.deleteRun },
  {
    id: 'start-workflow-run',
    pattern: /\b(?:Run workflow|Start workflow|Attach another workflow)\b/,
    use: NAMES.startRun,
  },
  { id: 'workflow-runs', pattern: /\bWorkflow runs\b/, use: NAMES.runs },
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
  { id: 'try-again', pattern: /^Try again(?: on [\w .-]+| with the hint)?$/, use: NAMES.retry },
  { id: 'your-roles', pattern: /\bYour roles\b/, use: NAMES.yourJob },
  { id: 'classic-bars', pattern: /\bClassic bars\b/, use: NAMES.legacyLayout },
  { id: 'open-review', pattern: /\bOpen Review\b(?! replies)/, use: NAMES.comments },
  { id: 'open-diff', pattern: /\bOpen diff\b/i, use: NAMES.files },
  { id: 'review-diff-view', pattern: /\b[Ii]n the (?:Review|Diff) view\b/, use: NAMES.comments },
  { id: 'rebase-in-the-diff', pattern: /\bRebase in the Diff\b/, use: NAMES.branch },
  { id: 'in-review-page', pattern: /\bin Review\b(?! replies)/, use: NAMES.comments },
  { id: 'defaults-page', pattern: /\b(?:in|then|Open) Defaults\b/, use: NAMES.models },
];
