import type { Notification } from '@goodboy/db';
import { useAppStore } from '../../store';
import { REPORT_ISSUE_STUDIO_EVENT } from './reportIssueStudioEvent';

type Params = {
  readonly notification: Notification;
};

export const sendNotificationToDevelopers = ({ notification }: Params): void => {
  const report = [notification.title, notification.body]
    .filter((part) => part != null && part !== '')
    .join('\n\n');
  const draft = useAppStore.getState().bugReportDraft;
  const description = draft.description === '' ? report : `${draft.description}\n\n${report}`;
  useAppStore.getState().setBugReportDraft({
    issueType: 'bug',
    title: draft.title === '' ? notification.title : draft.title,
    description,
  });
  window.dispatchEvent(new CustomEvent(REPORT_ISSUE_STUDIO_EVENT));
};
