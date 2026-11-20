import { AnchoredPopover, Button, useDropdown } from '@goodboy/ui';

type Props = {
  readonly detail: string;
};

const DETAIL_LIMIT = 4000;

export const JobBannerDetails = ({ detail }: Props) => {
  const dropdown = useDropdown({ align: 'end', width: 'w-96', expectedWidth: 384 });
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Push output"
      hasBackdrop
      bodyClassName="max-h-56"
      trigger={
        <Button size="sm" variant="ghost" aria-expanded={dropdown.open} onClick={dropdown.toggle}>
          Details
        </Button>
      }
    >
      <pre className="whitespace-pre-wrap break-words px-3 py-2 text-code text-muted-foreground">
        {detail.slice(0, DETAIL_LIMIT)}
      </pre>
    </AnchoredPopover>
  );
};
