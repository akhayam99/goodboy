// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { brandId } from '@goodboy/types';
import type { AgentId } from '@goodboy/types';
import { ReportProvenanceRow } from '.';

afterEach(cleanup);

const noop = () => undefined;

describe('the report provenance row', () => {
  it('says only that nothing from this session is cited when no source resolves', () => {
    const view = render(
      <ReportProvenanceRow
        reportType="Audit"
        links={[]}
        onOpenAgent={noop}
        onOpenArtifact={noop}
      />,
    );

    const row = view.getByTestId('report-provenance');
    expect(row.textContent).toContain('No sources from this session');
    expect(row.textContent).not.toContain('Cites no sources');
    expect(view.queryAllByTestId('report-source-chip')).toHaveLength(0);
  });

  it('shows the sources label and a chip per resolved source', () => {
    const view = render(
      <ReportProvenanceRow
        reportType="Audit"
        links={[
          {
            kind: 'agent',
            id: brandId<AgentId>({ value: 'agent-ledger' }),
            label: 'ledger-core reviewer',
          },
        ]}
        onOpenAgent={noop}
        onOpenArtifact={noop}
      />,
    );

    const row = view.getByTestId('report-provenance');
    expect(row.textContent).not.toContain('No sources from this session');
    expect(view.getAllByTestId('report-source-chip')).toHaveLength(1);
  });
});
