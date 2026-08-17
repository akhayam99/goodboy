type Props = {
  readonly joinsPrevious: boolean;
  readonly joinsNext: boolean;
};

export const TimelineRail = ({ joinsPrevious, joinsNext }: Props) => (
  <span className="relative h-full w-4 shrink-0" aria-hidden>
    {joinsPrevious ? <span className="absolute inset-x-[7px] top-0 h-1/2 bg-accent/30" /> : null}
    {joinsNext ? <span className="absolute inset-x-[7px] bottom-0 h-1/2 bg-accent/30" /> : null}
  </span>
);
