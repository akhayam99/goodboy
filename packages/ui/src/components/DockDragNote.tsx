type Props = {
  readonly text: string;
};

export const DockDragNote = ({ text }: Props) => (
  <p data-dock-note="" role="status" aria-live="polite" className="sr-only">
    {text}
  </p>
);
