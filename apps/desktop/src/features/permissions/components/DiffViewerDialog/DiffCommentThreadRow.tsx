import { cn } from '@goodboy/ui';
import type { AgentId, DiffComment } from '@goodboy/types';
import { DIFF_SCROLL_CONTENT_CLASS } from './lib';
import { CommentItem } from './comments/CommentItem';

type Props = {
  comments: ReadonlyArray<DiffComment>;
  colSpan: number;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
  onViewAgent: (agentId: AgentId) => void;
  getAgentName: (agentId: AgentId) => string | undefined;
};

export const DiffCommentThreadRow = ({
  comments,
  colSpan,
  onResolve,
  onReopen,
  onDelete,
  onViewAgent,
  getAgentName,
}: Props) => (
  <tr>
    <td colSpan={colSpan} className="bg-background">
      <div
        data-diff-scroll-content
        className={cn(DIFF_SCROLL_CONTENT_CLASS, 'flex flex-col gap-1.5 px-3 py-2')}
      >
        {comments.map((comment) => (
          <div key={comment.id} className="flex flex-col gap-0.5">
            {comment.anchor?.endLineNumber ? (
              <span className="text-3xs font-medium text-muted-foreground">
                lines {comment.anchor.lineNumber}–{comment.anchor.endLineNumber}
              </span>
            ) : null}
            <CommentItem
              comment={comment}
              onResolve={onResolve}
              onReopen={onReopen}
              onDelete={onDelete}
              onViewAgent={onViewAgent}
              getAgentName={getAgentName}
            />
          </div>
        ))}
      </div>
    </td>
  </tr>
);
