import type { SessionExternalTask } from '@goodboy/types';
import { CLOSING_KEYWORDS } from './closingKeywords';

export type ClosingIssueReference = Readonly<{
  number: number;
  identifier: string;
  title: string;
  url: string;
  line: string;
}>;

type Params = {
  readonly tasks: ReadonlyArray<SessionExternalTask>;
  readonly branch: string | null;
  readonly body: string;
};

export const closingIssueReferences = ({
  tasks,
  branch,
  body,
}: Params): ReadonlyArray<ClosingIssueReference> => {
  const byNumber = new Map<number, ClosingIssueReference>();
  for (const task of tasks) {
    if (task.provider !== 'github') {
      continue;
    }
    const taskBranch = task.branch ?? null;
    if (taskBranch !== null && branch !== null && taskBranch !== branch) {
      continue;
    }
    const raw = task.externalId.trim();
    const number = Number.parseInt(raw, 10);
    if (!Number.isSafeInteger(number) || number <= 0 || String(number) !== raw) {
      continue;
    }
    if (byNumber.has(number)) {
      continue;
    }
    const alreadyClosing = new RegExp(`\\b(?:${CLOSING_KEYWORDS})\\s+#${number}\\b`, 'i').test(
      body,
    );
    if (alreadyClosing) {
      continue;
    }
    byNumber.set(number, {
      number,
      identifier: task.identifier,
      title: task.title,
      url: task.url,
      line: `Closes #${number}`,
    });
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number);
};
