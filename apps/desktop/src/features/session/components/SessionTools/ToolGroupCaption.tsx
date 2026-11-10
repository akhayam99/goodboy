type Props = Record<never, never>;

export const ToolGroupCaption = ({}: Props) => (
  <span
    aria-hidden
    data-slot="tool-group-caption"
    className="whitespace-nowrap text-rail text-faint-foreground [@media(max-height:480px)]:hidden"
  >
    Session
  </span>
);
