import { Markdown } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { ToolImageScope } from '../../../../shared/components/ToolImageScope';

type Props = {
  readonly text: string;
  readonly workspaceId: WorkspaceId | null;
};

export const RenderedBody = ({ text, workspaceId }: Props) =>
  workspaceId === null ? (
    <Markdown text={text} className="text-prose" />
  ) : (
    <ToolImageScope workspaceId={workspaceId} provider="github">
      <Markdown text={text} className="text-prose" />
    </ToolImageScope>
  );
