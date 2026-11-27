type Props = {
  readonly message: string;
};

export const WidgetAnnouncer = ({ message }: Props) => (
  <div role="status" aria-live="assertive" aria-atomic="true" className="sr-only">
    {message}
  </div>
);
