import { renderReplyTemplate } from '../../../features/resolve/renderReplyTemplate';
import {
  REPLY_SETTINGS_DEFAULT,
  type ReplySettings,
} from '../../../features/resolve/replySettings';
import { appendAttribution } from '../../../shared/utils/attribution';

type Closure = { commitSha?: string; reason?: string; reply?: string };

export type ReplyContext = {
  readonly reviewer?: string | null;
  readonly file?: string | null;
  readonly line?: number | null;
  readonly fixupOfSha?: string | null;
};

const commitUrlOf = ({ sha, prUrl }: { readonly sha: string; readonly prUrl: string | null }) => {
  const url = prUrl ? prUrl.replace(/\/pull\/\d+(?:\/.*)?$/, `/commit/${sha}`) : null;
  return url !== null && url !== prUrl ? url : null;
};

const commitLink = ({ sha, prUrl }: { readonly sha: string; readonly prUrl: string | null }) => {
  const short = `\`${sha.slice(0, 7)}\``;
  const url = commitUrlOf({ sha, prUrl });
  return url === null ? short : `[${short}](${url})`;
};

type Params = {
  readonly closure: Closure | undefined;
  readonly prUrl: string | null;
  readonly settings?: ReplySettings;
  readonly context?: ReplyContext;
};

export const buildResolutionReplyBody = ({
  closure,
  prUrl,
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
    fixup_of: context.fixupOfSha ? commitLink({ sha: context.fixupOfSha, prUrl }) : '',
  };
  const body = (() => {
    if (sha.length > 0) {
      return renderReplyTemplate({
        template: settings.templateFixed,
        vars: { ...vars, reason: reply, commit: commitLink({ sha, prUrl }) },
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
