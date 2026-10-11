// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { nextSessionId } from '@goodboy/types/testing';
import { ReviewSettings } from './ReviewSettings';

afterEach(cleanup);

describe('ReviewSettings', () => {
  it('offers a manual target and a Retry when the branches failed to load', () => {
    const onBasesRetry = vi.fn();
    render(
      <ReviewSettings
        sessionId={nextSessionId()}
        base=""
        branches={[]}
        isBasesLoading={false}
        basesError="remote unreachable"
        onBasesRetry={onBasesRetry}
        isLocked={false}
        canSetDraft={false}
        isDraft={false}
        reviewers={[]}
        searchReviewers={null}
        references={[]}
        changelogEntry={null}
        onBaseChange={vi.fn()}
        onDraftChange={vi.fn()}
        onReviewersChange={vi.fn()}
        onReferenceRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert').textContent).toBe("Couldn't load branches");
    expect(screen.getByRole('textbox', { name: 'Target branch' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onBasesRetry).toHaveBeenCalledTimes(1);
  });
});
