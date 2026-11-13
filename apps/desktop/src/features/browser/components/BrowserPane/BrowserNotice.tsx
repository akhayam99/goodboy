type Props = {
  readonly notice: string | null;
};

export const BrowserNotice = ({ notice }: Props) =>
  notice === null ? null : (
    <p role="status" className="px-4 text-meta text-muted-foreground">
      {notice}
    </p>
  );
