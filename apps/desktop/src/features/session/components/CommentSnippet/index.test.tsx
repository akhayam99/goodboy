// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CommentSnippet } from './index';

const BUGBOT_BODY = [
  '### Missing UI language forcing **Medium Severity** <!-- DESCRIPTION START -->',
  '',
  'Use the translated label instead.',
  '',
  '```suggestion',
  '-  <Button>Submit</Button>',
  "+  <Button>{t('submit')}</Button>",
  '```',
].join('\n');

describe('CommentSnippet', () => {
  it('renders author and location', () => {
    render(<CommentSnippet author="octocat" location="src/App.tsx:12" body="looks good" />);
    expect(screen.getByText('octocat')).toBeTruthy();
    expect(screen.getByText('src/App.tsx:12')).toBeTruthy();
  });

  it('strips markdown source, HTML comment markers and fenced content from the body', () => {
    render(<CommentSnippet author="cursor[bot]" location="src/App.tsx:12" body={BUGBOT_BODY} />);
    expect(
      screen.getByText(
        'Missing UI language forcing Medium Severity Use the translated label instead.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/DESCRIPTION START/)).toBeNull();
    expect(screen.queryByText(/```/)).toBeNull();
    expect(screen.queryByText(/suggestion/)).toBeNull();
  });

  it('falls back to reviewer and conversation when author and location are missing', () => {
    render(<CommentSnippet body="hi" />);
    expect(screen.getByText('reviewer')).toBeTruthy();
    expect(screen.getByText('conversation')).toBeTruthy();
  });

  it('renders no body paragraph when body is empty', () => {
    const { container } = render(
      <CommentSnippet author="octocat" location="conversation" body="" />,
    );
    expect(container.querySelector('p')).toBeNull();
  });
});
