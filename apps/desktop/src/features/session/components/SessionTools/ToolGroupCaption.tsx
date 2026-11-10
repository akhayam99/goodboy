import type { SessionTool } from './sessionTools';

type Props = {
  readonly group: SessionTool['group'];
};

const GROUP_CAPTION = {
  session: 'Session',
  workspace: 'Workspace',
} as const satisfies Record<SessionTool['group'], string>;

export const ToolGroupCaption = ({ group }: Props) => (
  <span
    aria-hidden
    data-slot="tool-group-caption"
    className="whitespace-nowrap text-rail text-faint-foreground [@media(max-height:480px)]:hidden"
  >
    {GROUP_CAPTION[group]}
  </span>
);
