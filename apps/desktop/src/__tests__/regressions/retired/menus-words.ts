import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  { id: 'open-changes-lowercase', pattern: /\bOpen changes\b/, use: NAMES.openInChanges },
  { id: 'open-changes-title-case', pattern: /\bOpen Changes\b/, use: NAMES.openInChanges },
  { id: 'show-its-changes', pattern: /\bShow its changes\b/, use: NAMES.openInChanges },
  { id: 'open-terminal-bare', pattern: /\bOpen terminal\b/, use: NAMES.openInTerminal },
  { id: 'open-in-terminal-lowercase', pattern: /\bOpen in terminal\b/, use: NAMES.openInTerminal },
  {
    id: 'open-in-terminal-app',
    pattern: /\bOpen in terminal app\b/,
    use: NAMES.openInExternalTerminal,
  },
  { id: 'agent-transcript', pattern: /\bAgent transcript\b/, use: NAMES.openTranscript },
  { id: 'stop-the-fix-for', pattern: /\bStop the fix for\b/, use: NAMES.stopRun },
  { id: 'mark-read', pattern: /\bMark (?:un)?read\b/, use: NAMES.markAsRead },
  { id: 'mark-all-read', pattern: /\bMark all read\b/, use: NAMES.markAllAsRead },
  { id: 'ask-another-agent', pattern: /\bAsk another agent\b/, use: NAMES.messageAnAgent },
];
