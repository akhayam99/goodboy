import type { Notification } from '@goodboy/db';
import { useAppStore } from '../../store';
import { redactReportText } from '../../shared/utils/redactReportText';
import { REPORT_ISSUE_STUDIO_EVENT } from './reportIssueStudioEvent';

type Params = {
  readonly notification: Notification;
};

export const sendNotificationToDevelopers = ({ notification }: Params): void => {
  const title = redactReportText({ text: notification.title });
  const report = [
    title,
    notification.body == null ? '' : redactReportText({ text: notification.body }),
  ]
    .filter((part) => part !== '')
    .join('\n\n');
  const draft = useAppStore.getState().bugReportDraft;
  const description = draft.description === '' ? report : `${draft.description}\n\n${report}`;
  useAppStore.getState().setBugReportDraft({
    issueType: 'bug',
    title: draft.title === '' ? title : draft.title,
    description,
  });
  window.dispatchEvent(new CustomEvent(REPORT_ISSUE_STUDIO_EVENT));
};
