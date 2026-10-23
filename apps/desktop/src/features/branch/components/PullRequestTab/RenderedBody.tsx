import { Markdown } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { ToolImageScope } from '../../../../shared/components/ToolImageScope';
import { demoteBodyHeadings } from './demoteBodyHeadings';

type Props = {
  readonly text: string;
  readonly workspaceId: WorkspaceId | null;
  readonly demoteUnder?: string | null;
};

export const RenderedBody = ({ text, workspaceId, demoteUnder = null }: Props) => {
  const shown =
    demoteUnder === null ? text : demoteBodyHeadings({ text, sectionLabel: demoteUnder });
  return workspaceId === null ? (
    <Markdown text={shown} className="text-prose" />
  ) : (
    <ToolImageScope workspaceId={workspaceId} provider="github">
      <Markdown text={shown} className="text-prose" />
    </ToolImageScope>
  );
};
