type Props = {
  readonly onClose: () => void;
};

export const DropdownBackdrop = ({ onClose }: Props) => (
  <div className="fixed inset-0 z-popover-backdrop" onClick={onClose} aria-hidden />
);
