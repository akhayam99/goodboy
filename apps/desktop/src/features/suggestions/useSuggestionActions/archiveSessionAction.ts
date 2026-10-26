import type { Session } from '@goodboy/types';
import type { ShowToast } from '../../../shared/components/Toast';
import type { AppStore } from '../../../store/store';
import { archiveSessions } from '../../session/sessionArchive';

type Params = {
  readonly session: Session;
  readonly bulkArchiveTask: AppStore['bulkArchiveTask'];
  readonly bulkUnarchiveTask: AppStore['bulkUnarchiveTask'];
  readonly showToast: ShowToast;
};

export const archiveSessionAction = ({
  session,
  bulkArchiveTask,
  bulkUnarchiveTask,
  showToast,
}: Params) => ({
  label: 'Archive',
  isDisabled: false,
  failureTitle: "Couldn't archive the session",
  run: async () => {
    const { failed } = await archiveSessions({
      sessions: [session],
      bulkArchiveTask,
      bulkUnarchiveTask,
      showToast,
    });
    if (failed.length > 0) {
      throw new Error('The session stays where it was.');
    }
  },
});
