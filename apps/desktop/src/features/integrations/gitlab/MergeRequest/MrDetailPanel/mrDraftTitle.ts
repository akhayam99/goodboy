import { gitlabDraftTitle } from '@goodboy/core/review-source';

type Params = {
  readonly title: string;
  readonly isDraft: boolean;
};

export const mrDraftTitle = ({ title, isDraft }: Params): string =>
  gitlabDraftTitle({ title, isDraft });
