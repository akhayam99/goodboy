// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThreadReactions } from './index';

const TS = '1723456999.000100';

afterEach(cleanup);

describe('ThreadReactions', () => {
  it('reacts to the message it sits on with a quick reaction', () => {
    const onReact = vi.fn();
    render(<ThreadReactions messageTs={TS} reactions={[]} isWriting={false} onReact={onReact} />);

    fireEvent.click(screen.getByRole('button', { name: 'React with :tada:' }));

    expect(onReact).toHaveBeenCalledWith({ messageTs: TS, name: 'tada' });
  });

  it('adds to a reaction already on the message', () => {
    const onReact = vi.fn();
    render(
      <ThreadReactions
        messageTs={TS}
        reactions={[{ name: 'eyes', count: 2 }]}
        isWriting={false}
        onReact={onReact}
      />,
    );

    const pill = screen.getByRole('button', { name: 'React with :eyes:' });
    expect(pill.textContent).toContain('2');
    fireEvent.click(pill);
    expect(onReact).toHaveBeenCalledWith({ messageTs: TS, name: 'eyes' });
  });

  it('disables reactions with a reason while a write runs', () => {
    render(
      <ThreadReactions
        messageTs={TS}
        reactions={[{ name: 'eyes', count: 2 }]}
        isWriting
        onReact={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: 'React with :eyes:' });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('title')).toBe('Waiting for the current Slack write');
  });
});
