import { useMemo } from 'react';
import { ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { COMMENT_RUN_COPY } from '../../commentRunCopy';
import { commentScopeOf } from '../../commentScopeOf';
import { commentScopeSentenceOf } from '../../commentScopeSentenceOf';

type Props = {
  readonly body: string;
  readonly path: string | null;
};

const RunIcon = CONCEPT_ICONS.runs;

export const CommentRunSuggestion = ({ body, path }: Props) => {
  const sentence = useMemo(
    () => commentScopeSentenceOf({ scope: commentScopeOf({ body, path }) }),
    [body, path],
  );
  return (
    <div data-comment-run-suggest="" className="flex min-w-0 items-start gap-2">
      <span className="flex h-5 shrink-0 items-center text-info">
        <RunIcon size={ICON_SIZE.control} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-row text-foreground">{COMMENT_RUN_COPY.suggestTitle}</p>
        <p className="text-meta text-muted-foreground">
          {sentence.length > 0 ? `${sentence} ` : ''}
          {COMMENT_RUN_COPY.suggestWhy}
        </p>
      </div>
    </div>
  );
};
