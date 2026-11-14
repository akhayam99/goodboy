import { TEXT_ROLE, cn } from '@goodboy/ui';

type Props = Record<never, never>;

export const ToolGroupCaption = ({}: Props) => (
  <span
    aria-hidden
    data-slot="tool-group-caption"
    className={cn(
      'whitespace-nowrap text-rail [@media(max-height:480px)]:hidden',
      TEXT_ROLE.secondary,
    )}
  >
    Tools
  </span>
);
