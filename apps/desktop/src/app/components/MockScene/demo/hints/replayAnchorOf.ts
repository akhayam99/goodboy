type Params = {
  readonly root: Document;
};

const REPLAY_BLOCK = '[data-demo-anchor="plan-replay"]';
const PLAN_PARAGRAPHS = '[data-testid="plan-prose-comments"] p';
const COMMENT_BUTTON = 'button[aria-label="Comment on this text"]';

export const replayAnchorOf = ({ root }: Params): string | null => {
  const block = [...root.querySelectorAll(PLAN_PARAGRAPHS)].find((paragraph) =>
    (paragraph.textContent ?? '').includes('replay test'),
  );
  if (block === undefined) {
    return null;
  }
  block.setAttribute('data-demo-anchor', 'plan-replay');
  if (root.querySelector(COMMENT_BUTTON) !== null) {
    return COMMENT_BUTTON;
  }
  block.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  return REPLAY_BLOCK;
};
