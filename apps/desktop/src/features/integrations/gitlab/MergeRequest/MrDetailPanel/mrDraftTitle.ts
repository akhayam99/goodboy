import { gitlabDraftTitle, stripGitlabDraftPrefix } from '@goodboy/core';

type StripParams = {
  readonly title: string;
};

type Params = {
  readonly title: string;
  readonly isDraft: boolean;
};

export const stripDraftPrefix = ({ title }: StripParams): string =>
  stripGitlabDraftPrefix({ title });

export const mrDraftTitle = ({ title, isDraft }: Params): string =>
  gitlabDraftTitle({ title, isDraft });
