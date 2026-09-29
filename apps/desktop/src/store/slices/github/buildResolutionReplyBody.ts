import { commitLinkOf, type ReviewSourceKind } from '@goodboy/core';
import { renderReplyTemplate } from '../../../features/resolve/renderReplyTemplate';
import {
  REPLY_SETTINGS_DEFAULT,
  type ReplySettings,
} from '../../../features/resolve/replySettings';
import { appendAttribution } from '../../../shared/utils/attribution';

export type ReplyCommitStory = {
  readonly originalSha: string;
  readonly isFolded: boolean;
};

type Closure = { commitSha?: string; reason?: string; reply?: string };

export type ReplyContext = {
  readonly reviewer?: string | null;
  readonly file?: string | null;
  readonly line?: number | null;
  readonly fixupOfSha?: string | null;
  readonly commitStory?: ReplyCommitStory | null;
};

type LinkParams = {
  readonly sha: string;
  readonly prUrl: string | null;
  readonly sourceKind?: ReviewSourceKind;
};

export const commitLink = ({ sha, prUrl, sourceKind = 'github' }: LinkParams) => {
  const short = `\`${sha.slice(0, 7)}\``;
  const url = commitLinkOf({ kind: sourceKind, url: prUrl, sha });
  return url === null ? short : `[${short}](${url})`;
};

const commitStoryOf = ({
  sha,
  story,
  prUrl,
  sourceKind,
}: {
  readonly sha: string;
  readonly story: ReplyCommitStory | null | undefined;
  readonly prUrl: string | null;
  readonly sourceKind: ReviewSourceKind;
}): string => {
  const final = commitLink({ sha, prUrl, sourceKind });
  if (!story?.isFolded || story.originalSha === sha) {
    return final;
  }
  return `${commitLink({ sha: story.originalSha, prUrl, sourceKind })}, squashed into ${final}`;
};

type Params = {
  readonly closure: Closure | undefined;
  readonly prUrl: string | null;
  readonly sourceKind?: ReviewSourceKind;
  readonly settings?: ReplySettings;
  readonly context?: ReplyContext;
};

export const buildResolutionReplyBody = ({
  closure,
  prUrl,
  sourceKind = 'github',
  settings = REPLY_SETTINGS_DEFAULT,
  context = {},
}: Params): string | null => {
  if (!closure) {
    return null;
  }
  const reply = closure.reply?.trim() ?? '';
  const sha = closure.commitSha?.trim() ?? '';
  const reason = closure.reason?.trim() ?? '';
  const vars = {
    reviewer: context.reviewer ? `@${context.reviewer}` : '',
    file: context.file ?? '',
    line: context.line == null ? '' : String(context.line),
    fixup_of: context.fixupOfSha ? commitLink({ sha: context.fixupOfSha, prUrl, sourceKind }) : '',
  };
  const body = (() => {
    if (sha.length > 0) {
      return renderReplyTemplate({
        template: settings.templateFixed,
        vars: {
          ...vars,
          reason: reply,
          commit: commitLink({ sha, prUrl, sourceKind }),
          commit_story: commitStoryOf({ sha, story: context.commitStory, prUrl, sourceKind }),
        },
      });
    }
    if (reason.length > 0) {
      return renderReplyTemplate({
        template: settings.templateNoChange,
        vars: { ...vars, reason: reply.length > 0 ? reply : reason },
      });
    }
    return reply.length > 0 ? reply : null;
  })();

  return body === null || body === ''
    ? null
    : appendAttribution({ body, isEnabled: settings.isSigned, syntax: 'markdown' });
};
