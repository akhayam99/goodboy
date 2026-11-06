// @vitest-environment happy-dom

import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  ArtifactComment,
  ArtifactCommentAnchor,
  ArtifactId,
  IsoDateTime,
  SessionId,
} from '@goodboy/types';
import {
  PlanCommentsContext,
  type PlanCommentsApi,
} from '../../../plans/planComments/planCommentsContext';
import { PartCommentFrame } from './PartCommentFrame';
import { PlanCommentBar } from './PlanCommentBar';
import { PlanProse } from './PlanProse';

const NOW = '2026-09-14T16:40:00.000Z' as IsoDateTime;

const comment = ({
  id,
  anchor,
  body,
  status = 'draft',
  revision = 1,
}: {
  readonly id: string;
  readonly anchor: ArtifactCommentAnchor;
  readonly body: string;
  readonly status?: ArtifactComment['status'];
  readonly revision?: number;
}): ArtifactComment => ({
  id,
  sessionId: 'session' as SessionId,
  artifactId: 'plan' as ArtifactId,
  revision,
  anchor,
  body,
  status,
  sentTurnId: null,
  createdAt: NOW,
  updatedAt: NOW,
});

const api = (overrides: Partial<PlanCommentsApi> = {}): PlanCommentsApi => ({
  comments: [],
  revision: 1,
  canComment: true,
  isPlanRan: false,
  composing: null,
  startComposing: vi.fn(),
  cancelComposing: vi.fn(),
  add: vi.fn(async () => undefined),
  edit: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
  ...overrides,
});

const withApi = ({ value, children }: { value: PlanCommentsApi; children: React.ReactNode }) => (
  <PlanCommentsContext.Provider value={value}>{children}</PlanCommentsContext.Provider>
);

const ROW = { index: 2, title: 'Backfill the ledger' } as const;

const Framed = ({ children }: { children: React.ReactNode }) => (
  <PartCommentFrame index={ROW.index} title={ROW.title}>
    {children}
  </PartCommentFrame>
);

afterEach(cleanup);

describe('PartCommentFrame', () => {
  it('starts a comment on the part from its Comment button', () => {
    const value = api();
    render(
      withApi({
        value,
        children: (
          <Framed>
            <div>part row</div>
          </Framed>
        ),
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Comment on part 3' }));
    expect(value.startComposing).toHaveBeenCalledWith({
      anchor: { kind: 'part', index: 2, title: 'Backfill the ledger' },
    });
  });

  it('shows the drafts of this part only, with a Draft tag, and removes one', () => {
    const value = api({
      comments: [
        comment({
          id: 'mine',
          anchor: { kind: 'part', index: 2, title: ROW.title },
          body: 'Limit the backfill to 90 days',
        }),
        comment({
          id: 'other',
          anchor: { kind: 'part', index: 0, title: 'Add the key' },
          body: 'Name the index',
        }),
      ],
    });
    render(withApi({ value, children: <Framed>row</Framed> }));
    const card = screen.getByTestId('plan-comment');
    expect(within(card).getByText('Limit the backfill to 90 days')).toBeDefined();
    expect(within(card).getByText('You')).toBeDefined();
    expect(within(card).getByText('Draft')).toBeDefined();
    expect(screen.queryByText('Name the index')).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: 'Remove comment' }));
    expect(value.remove).toHaveBeenCalledWith({ commentId: 'mine' });
  });

  it('tags a draft Not sent once the plan ran', () => {
    const value = api({
      isPlanRan: true,
      comments: [
        comment({
          id: 'c-late',
          anchor: { kind: 'part', index: 2, title: ROW.title },
          body: 'Limit the backfill',
        }),
      ],
    });
    render(withApi({ value, children: <Framed>row</Framed> }));

    expect(within(screen.getByTestId('plan-comment')).getByText('Not sent')).toBeDefined();
    expect(screen.queryByText('Draft')).toBeNull();
  });

  it('labels each state after the send and offers no remove', () => {
    const anchor: ArtifactCommentAnchor = { kind: 'part', index: 2, title: ROW.title };
    const value = api({
      revision: 2,
      comments: [
        comment({ id: 'a', anchor, body: 'sent one', status: 'sent' }),
        comment({ id: 'b', anchor, body: 'addressed one', status: 'addressed' }),
        comment({ id: 'c', anchor, body: 'open one', status: 'open' }),
        comment({ id: 'd', anchor, body: 'quiet one', status: 'open', revision: 2 }),
      ],
    });
    render(withApi({ value, children: <Framed>row</Framed> }));
    expect(screen.getByText('Sent')).toBeDefined();
    expect(screen.getByText('Addressed')).toBeDefined();
    expect(screen.getByText('Not changed in v2')).toBeDefined();
    expect(screen.getByText('No new version in this turn')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Remove comment' })).toBeNull();
  });

  it('adds the comment from the composer with the button and with Cmd+Enter', async () => {
    const value = api({
      composing: { anchor: { kind: 'part', index: 2, title: ROW.title } },
    });
    render(withApi({ value, children: <Framed>row</Framed> }));
    const add = screen.getByRole('button', { name: 'Add comment' });
    expect((add as HTMLButtonElement).disabled).toBe(true);
    const box = screen.getByLabelText('Comment for the planner');
    fireEvent.change(box, { target: { value: 'Split in two' } });
    fireEvent.click(add);
    await waitFor(() => expect(value.add).toHaveBeenCalledWith({ body: 'Split in two' }));
    fireEvent.keyDown(box, { key: 'Enter', metaKey: true });
    await waitFor(() => expect(value.add).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(value.cancelComposing).toHaveBeenCalled();
  });

  describe('a comment typed and not added', () => {
    const composing: PlanCommentsApi['composing'] = {
      anchor: { kind: 'part', index: 2, title: ROW.title },
    };
    const escape = () => fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    it('is kept as a draft when focus leaves the box', async () => {
      const value = api({ composing });
      render(withApi({ value, children: <Framed>row</Framed> }));
      const box = screen.getByLabelText('Comment for the planner');
      fireEvent.change(box, { target: { value: 'Split in two' } });

      fireEvent.blur(box);

      await waitFor(() => expect(value.add).toHaveBeenCalledWith({ body: 'Split in two' }));
      expect(value.cancelComposing).not.toHaveBeenCalled();
    });

    it('is kept as a draft on Esc, and says so', async () => {
      const value = api({ composing });
      render(withApi({ value, children: <Framed>row</Framed> }));
      expect(screen.getByText('Esc keeps it as a draft')).toBeDefined();
      fireEvent.change(screen.getByLabelText('Comment for the planner'), {
        target: { value: 'Split in two' },
      });

      escape();

      await waitFor(() => expect(value.add).toHaveBeenCalledWith({ body: 'Split in two' }));
      expect(value.cancelComposing).not.toHaveBeenCalled();
    });

    it('closes on Esc when the box is empty, and saves nothing', () => {
      const value = api({ composing });
      render(withApi({ value, children: <Framed>row</Framed> }));

      escape();

      expect(value.cancelComposing).toHaveBeenCalledTimes(1);
      expect(value.add).not.toHaveBeenCalled();
    });

    it('is not saved when focus only moves to a button of the composer', () => {
      const value = api({ composing });
      render(withApi({ value, children: <Framed>row</Framed> }));
      const box = screen.getByLabelText('Comment for the planner');
      fireEvent.change(box, { target: { value: 'Split in two' } });

      fireEvent.blur(box, { relatedTarget: screen.getByRole('button', { name: 'Cancel' }) });
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Cancel' }));
      fireEvent.blur(box);

      expect(value.add).not.toHaveBeenCalled();
    });

    it('stays in the box with the error when the save fails', async () => {
      const value = api({
        composing,
        add: vi.fn(async () => {
          throw new Error('The database is locked');
        }),
      });
      render(withApi({ value, children: <Framed>row</Framed> }));
      const box = screen.getByLabelText('Comment for the planner');
      fireEvent.change(box, { target: { value: 'Split in two' } });

      fireEvent.blur(box);

      expect((await screen.findByRole('alert')).textContent).toContain('The database is locked');
      expect(box).toHaveProperty('value', 'Split in two');
      expect(value.cancelComposing).not.toHaveBeenCalled();
    });
  });

  it('opens the composer under the part with focus in it, and gives focus back to its Comment button on close', () => {
    const Harness = () => {
      const [composing, setComposing] = useState<PlanCommentsApi['composing']>(null);
      const value = api({
        composing,
        startComposing: ({ anchor }) => setComposing({ anchor }),
        cancelComposing: () => setComposing(null),
      });
      return withApi({ value, children: <Framed>row</Framed> });
    };
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Comment on part 3' });
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    trigger.focus();
    fireEvent.click(trigger);

    const box = screen.getByLabelText('Comment for the planner');
    expect(document.activeElement).toBe(box);
    expect(scrolled).toHaveBeenCalledWith({ block: 'nearest' });
    const frame = screen.getByTestId('plan-part-comments');
    expect(frame.contains(box)).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText('Comment for the planner')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Comment on part 3' }));
  });

  it('falls back to the part itself when the trigger is gone', () => {
    const Harness = () => {
      const [composing, setComposing] = useState<PlanCommentsApi['composing']>({
        anchor: { kind: 'part', index: 2, title: ROW.title },
      });
      const value = api({ composing, cancelComposing: () => setComposing(null) });
      return withApi({ value, children: <Framed>row</Framed> });
    };
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(document.activeElement).toBe(screen.getByTestId('plan-part-comments'));
  });

  it('hides the Comment button when comments are closed', () => {
    render(
      withApi({
        value: api({ canComment: false }),
        children: <Framed>row</Framed>,
      }),
    );
    expect(screen.queryByRole('button', { name: 'Comment on part 3' })).toBeNull();
  });
});

describe('PlanProse', () => {
  const TEXT = 'Stop the duplicate credit.\n\nShip behind a flag.';

  it('offers Comment on the hovered paragraph and anchors it by text', async () => {
    const value = api();
    const { container } = render(
      withApi({ value, children: <PlanProse text={TEXT} section="lead" /> }),
    );
    const second = [...container.querySelectorAll('p')].find(
      (p) => p.textContent === 'Ship behind a flag.',
    );
    if (second === undefined) {
      throw new Error('paragraph not rendered');
    }
    await waitFor(() => expect(container.querySelectorAll('p').length).toBe(2));
    fireEvent.mouseOver(second);
    fireEvent.click(await screen.findByRole('button', { name: 'Comment on this text' }));
    expect(value.startComposing).toHaveBeenCalledWith({
      anchor: { kind: 'block', order: 1, text: 'Ship behind a flag.' },
    });
  });

  it('numbers the blocks of the rest of the plan after the parts', async () => {
    const value = api();
    const { container } = render(
      withApi({ value, children: <PlanProse text={'## Rollout\n\nShip it.'} section="rest" /> }),
    );
    const paragraph = container.querySelector('p');
    if (paragraph === null) {
      throw new Error('paragraph not rendered');
    }
    await waitFor(() => expect(container.querySelector('h2')).not.toBeNull());
    fireEvent.mouseOver(paragraph);
    fireEvent.click(await screen.findByRole('button', { name: 'Comment on this text' }));
    expect(value.startComposing).toHaveBeenCalledWith({
      anchor: { kind: 'block', order: 2001, text: 'Ship it.' },
    });
  });

  it('renders a draft under the paragraph it is anchored to', async () => {
    const value = api({
      comments: [
        comment({
          id: 'c1',
          anchor: { kind: 'block', order: 0, text: 'Stop the duplicate credit.' },
          body: 'Say which credit',
        }),
      ],
    });
    const { container } = render(
      withApi({ value, children: <PlanProse text={TEXT} section="lead" /> }),
    );
    const note = await screen.findByText('Say which credit');
    const slot = note.closest('[data-comment-slot]');
    expect(slot).not.toBeNull();
    expect(slot?.previousElementSibling?.textContent).toBe('Stop the duplicate credit.');
    expect(container.querySelectorAll('[data-comment-slot]').length).toBe(1);
  });

  it('does not offer a comment on a comment card', async () => {
    const value = api({
      comments: [
        comment({
          id: 'c1',
          anchor: { kind: 'block', order: 0, text: 'Stop the duplicate credit.' },
          body: 'Say which credit',
        }),
      ],
    });
    render(withApi({ value, children: <PlanProse text={TEXT} section="lead" /> }));
    fireEvent.mouseOver(await screen.findByText('Say which credit'));
    expect(screen.queryByRole('button', { name: 'Comment on this text' })).toBeNull();
  });

  it('keeps a comment whose text the planner rewrote in a group below the text', async () => {
    const value = api({
      revision: 2,
      comments: [
        comment({
          id: 'c1',
          anchor: { kind: 'block', order: 0, text: 'A sentence that is gone.' },
          body: 'Why this?',
          status: 'addressed',
        }),
      ],
    });
    render(withApi({ value, children: <PlanProse text={TEXT} section="lead" /> }));
    expect(await screen.findByText('Your notes on changed text')).toBeDefined();
    expect(screen.getByText('Why this?')).toBeDefined();
  });

  it('shows a floating Comment for a text selection and anchors the quote', async () => {
    const value = api();
    const { container } = render(
      withApi({ value, children: <PlanProse text={TEXT} section="lead" /> }),
    );
    await waitFor(() => expect(container.querySelectorAll('p').length).toBe(2));
    const paragraph = container.querySelector('p');
    const textNode = paragraph?.firstChild;
    if (paragraph === null || textNode === null || textNode === undefined) {
      throw new Error('paragraph not rendered');
    }
    const range = document.createRange();
    range.setStart(textNode, 'Stop the '.length);
    range.setEnd(textNode, 'Stop the duplicate credit'.length);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    fireEvent.mouseUp(screen.getByTestId('plan-prose-comments'));
    fireEvent.click(await screen.findByRole('button', { name: 'Comment on the selected text' }));
    expect(value.startComposing).toHaveBeenCalledWith({
      anchor: {
        kind: 'quote',
        order: 0,
        text: 'duplicate credit',
        blockText: 'Stop the duplicate credit.',
      },
    });
  });

  it('offers one Comment at a time: the selection chip replaces the block button', async () => {
    const value = api();
    const { container } = render(
      withApi({ value, children: <PlanProse text={TEXT} section="lead" /> }),
    );
    await waitFor(() => expect(container.querySelectorAll('p').length).toBe(2));
    const paragraph = container.querySelector('p');
    const textNode = paragraph?.firstChild;
    if (paragraph === null || textNode === null || textNode === undefined) {
      throw new Error('paragraph not rendered');
    }
    fireEvent.mouseOver(paragraph);
    expect(await screen.findByRole('button', { name: 'Comment on this text' })).toBeDefined();

    const range = document.createRange();
    range.setStart(textNode, 'Stop the '.length);
    range.setEnd(textNode, 'Stop the duplicate credit'.length);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    fireEvent.mouseUp(screen.getByTestId('plan-prose-comments'));

    expect(
      await screen.findByRole('button', { name: 'Comment on the selected text' }),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Comment on this text' })).toBeNull();
  });

  it('shows the quote in italic above the composer of a selection comment', async () => {
    const value = api({
      composing: {
        anchor: {
          kind: 'quote',
          order: 0,
          text: 'duplicate credit',
          blockText: 'Stop the duplicate credit.',
        },
      },
    });
    render(withApi({ value, children: <PlanProse text={TEXT} section="lead" /> }));
    const composer = await screen.findByTestId('plan-comment-composer');
    expect(within(composer).getByText('duplicate credit').tagName).toBe('Q');
  });

  it('offers no hover button without the right to comment', async () => {
    const { container } = render(
      withApi({
        value: api({ canComment: false }),
        children: <PlanProse text={TEXT} section="lead" />,
      }),
    );
    await waitFor(() => expect(container.querySelectorAll('p').length).toBe(2));
    const paragraph = container.querySelector('p');
    if (paragraph !== null) {
      fireEvent.mouseOver(paragraph);
    }
    expect(screen.queryByRole('button', { name: 'Comment on this text' })).toBeNull();
  });
});

describe('PlanCommentBar', () => {
  const allowed = { canSend: true, reason: null };

  it('counts the comments and sends', () => {
    const onSend = vi.fn(async () => undefined);
    render(
      <PlanCommentBar count={2} guard={allowed} isSending={false} error={null} onSend={onSend} />,
    );
    expect(screen.getByText('2 comments')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Send to planner' }));
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  });

  it('says why Send is off', () => {
    const onSend = vi.fn(async () => undefined);
    render(
      <PlanCommentBar
        count={1}
        guard={{ canSend: false, reason: "This plan already ran. Comments can't change it." }}
        isSending={false}
        error={null}
        onSend={onSend}
      />,
    );
    expect(screen.getByText('1 comment')).toBeDefined();
    expect(screen.getByText("This plan already ran. Comments can't change it.")).toBeDefined();
    const send = screen.getByRole('button', { name: 'Send to planner' });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(send);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('makes Send the one filled button', () => {
    render(
      <PlanCommentBar
        count={1}
        guard={allowed}
        isSending={false}
        error={null}
        onSend={vi.fn(async () => undefined)}
      />,
    );
    expect(screen.getByTestId('plan-bar-send').getAttribute('data-filled')).toBe('true');
    expect(screen.queryByTestId('plan-bar-approve')).toBeNull();
  });

  it('stays with a hint when there is no comment yet', () => {
    render(
      <PlanCommentBar
        count={0}
        guard={allowed}
        isSending={false}
        error={null}
        onSend={vi.fn(async () => undefined)}
      />,
    );
    expect(screen.getByText('Select text or click a block to comment')).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows a send failure as an alert', () => {
    render(
      <PlanCommentBar
        count={1}
        guard={allowed}
        isSending={false}
        error="The session budget is reached."
        onSend={vi.fn(async () => undefined)}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('The session budget is reached.');
  });
});
