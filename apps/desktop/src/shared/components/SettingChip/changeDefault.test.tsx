import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useDropdown } from '@goodboy/ui';
import { SettingChip } from '.';

type HarnessProps = {
  readonly onChangeDefault?: () => void;
};

const Harness = ({ onChangeDefault }: HarnessProps) => {
  const dropdown = useDropdown({ expectedHeight: 200, expectedWidth: 280, width: 'w-72' });
  return (
    <SettingChip
      dropdown={dropdown}
      label="Asks you"
      words={{ value: 'After the plan', source: 'from Harborline', chain: 'From Harborline.' }}
      help="When the run stops."
      error={null}
      {...(onChangeDefault === undefined ? {} : { onChangeDefault })}
    >
      <span>Body</span>
    </SettingChip>
  );
};

afterEach(cleanup);

describe('SettingChip change default link', () => {
  it('shows Change default in the popover header and calls it', () => {
    const onChangeDefault = vi.fn();
    render(<Harness onChangeDefault={onChangeDefault} />);

    fireEvent.click(screen.getByRole('button', { name: /^Asks you: After the plan/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Change default' }));

    expect(onChangeDefault).toHaveBeenCalledOnce();
  });

  it('shows no link when the chip has no default page', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: /^Asks you: After the plan/ }));

    expect(screen.queryByRole('button', { name: 'Change default' })).toBeNull();
  });
});
