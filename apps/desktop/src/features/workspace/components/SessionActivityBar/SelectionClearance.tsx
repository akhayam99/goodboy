const DOCK_BOTTOM_OFFSET = 24;

type Props = {
  readonly dockHeight: number;
};

export const SelectionClearance = ({ dockHeight }: Props) => (
  <div
    aria-hidden
    data-testid="session-list-clearance"
    style={{ height: dockHeight === 0 ? 0 : dockHeight + DOCK_BOTTOM_OFFSET }}
  />
);
