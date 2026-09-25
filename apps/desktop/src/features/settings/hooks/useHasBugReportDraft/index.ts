import { useAppStore } from '../../../../store';
import { emptyBugReportDraft } from '../../../../store/slices/bugReportDraft/state';

export const useHasBugReportDraft = (): boolean =>
  useAppStore(
    (s) =>
      s.bugReportDraft.title !== '' ||
      s.bugReportDraft.description !== '' ||
      s.bugReportDraft.issueType !== emptyBugReportDraft.issueType ||
      s.bugReportDraft.images.length > 0,
  );
