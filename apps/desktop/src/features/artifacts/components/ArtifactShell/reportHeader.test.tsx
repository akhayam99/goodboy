// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ArtifactShellHeader } from './ArtifactShellHeader';

afterEach(cleanup);

type HeaderParams = {
  readonly isTitleInDocument: boolean;
};

const renderHeader = ({ isTitleInDocument }: HeaderParams) =>
  render(
    <ArtifactShellHeader
      kind="report"
      title="Retried webhooks no longer double credit"
      isTitleInDocument={isTitleInDocument}
      chip={null}
      actions={null}
      meta={null}
    />,
  );

describe('ArtifactShellHeader', () => {
  it('draws the kind glyph before a title it shows', () => {
    renderHeader({ isTitleInDocument: false });

    const header = screen.getByTestId('artifact-shell-header');
    expect(header.querySelector('svg')).not.toBeNull();
  });

  it('draws no lone glyph when the title is in the document below', () => {
    renderHeader({ isTitleInDocument: true });

    const header = screen.getByTestId('artifact-shell-header');
    expect(header.querySelector('svg')).toBeNull();
  });
});
