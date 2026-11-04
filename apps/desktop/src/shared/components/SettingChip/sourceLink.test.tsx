import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useDropdown } from '@goodboy/ui';
import { SettingChip } from '.';

type HarnessProps = {
  readonly isFromWorkspace: boolean;
  readonly onOpenSource?: () => void;
};

const Harness = ({ isFromWorkspace, onOpenSource }: HarnessProps) => {
  const dropdown = useDropdown({ expectedHeight: 200, expectedWidth: 280, width: 'w-72' });
  return (
    <SettingChip
      dropdown={dropdown}
      label="Limit"
      words={{
        value: '$0.85 of $5.00',
        source: 'from Harborline',
        chain: 'From Harborline.',
        ...(isFromWorkspace && { isFromWorkspace: true }),
      }}
      help="What it may spend."
      error={null}
      {...(onOpenSource === undefined ? {} : { onOpenSource })}
    >
      <span>Body</span>
    </SettingChip>
  );
};

afterEach(cleanup);

describe('SettingChip source link', () => {
  it('turns a workspace source into a link that opens its Run defaults', () => {
    const onOpenSource = vi.fn();
    render(<Harness isFromWorkspace onOpenSource={onOpenSource} />);

    fireEvent.click(screen.getByRole('button', { name: /^Limit: \$0.85 of \$5.00/ }));
    fireEvent.click(screen.getByRole('button', { name: 'from Harborline' }));

    expect(onOpenSource).toHaveBeenCalledOnce();
  });

  it('keeps a source that is not a workspace as plain text', () => {
    render(<Harness isFromWorkspace={false} onOpenSource={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /^Limit: \$0.85 of \$5.00/ }));

    expect(screen.queryByRole('button', { name: 'from Harborline' })).toBeNull();
    screen.getByText('from Harborline');
  });
});
