// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { WireframeDocument, WireframeScreen } from '@goodboy/core';
import { buildWireframeIndex } from '../../wireframeIndex';
import {
  buildFlowLayout,
  WireframeFlowOverview,
  type FlowBox,
  type FlowEdge,
  type FlowLabel,
  type FlowLayout,
} from './WireframeFlowOverview';

const screenOf = ({
  id,
  title,
  actions,
}: {
  readonly id: string;
  readonly title: string;
  readonly actions: number;
}): WireframeScreen => ({
  id,
  title,
  viewport: 'desktop',
  root: {
    id: `${id}-root`,
    kind: 'stack',
    direction: 'column',
    children: Array.from({ length: actions }, (_, position) => ({
      id: `${id}-a${position}`,
      kind: 'button',
      label: `action ${position}`,
    })),
  },
});

const SIMPLE: WireframeDocument = {
  version: 1,
  initialScreenId: 'sign-in',
  theme: { name: 'harborline' },
  screens: [
    screenOf({ id: 'sign-in', title: 'Sign In', actions: 1 }),
    screenOf({ id: 'workspaces', title: 'Workspaces', actions: 1 }),
    screenOf({ id: 'ledger', title: 'Ledger Board', actions: 1 }),
    screenOf({ id: 'entry', title: 'Entry Detail', actions: 1 }),
  ],
  transitions: [
    { fromNodeId: 'sign-in-a0', toScreenId: 'workspaces', label: 'Continue' },
    { fromNodeId: 'workspaces-a0', toScreenId: 'ledger', label: 'Open workspace' },
    { fromNodeId: 'ledger-a0', toScreenId: 'entry', label: 'Select entry' },
  ],
};

const LONG_LABEL = 'Skip the receipt when the settlement window is already closed for the period';

const HARD: WireframeDocument = {
  version: 1,
  initialScreenId: 'launch',
  theme: { name: 'northwind' },
  screens: [
    screenOf({ id: 'launch', title: 'Launch', actions: 2 }),
    screenOf({ id: 'triage', title: 'Triage Queue', actions: 2 }),
    screenOf({ id: 'review', title: 'Batch Review', actions: 3 }),
    screenOf({ id: 'approve', title: 'Approval', actions: 2 }),
    screenOf({ id: 'receipt', title: 'Receipt', actions: 1 }),
    screenOf({ id: 'audit', title: 'Audit Log', actions: 1 }),
    screenOf({ id: 'settings', title: 'Relay Settings', actions: 1 }),
  ],
  transitions: [
    { fromNodeId: 'launch-a0', toScreenId: 'triage', label: 'Sign in' },
    { fromNodeId: 'launch-a1', toScreenId: 'review', label: 'Resume last batch' },
    { fromNodeId: 'triage-a0', toScreenId: 'review', label: 'Open batch' },
    { fromNodeId: 'triage-a1', toScreenId: 'settings', label: 'Configure notify-relay' },
    { fromNodeId: 'review-a0', toScreenId: 'approve', label: 'Approve' },
    { fromNodeId: 'review-a1', toScreenId: 'approve', label: 'Approve with override' },
    { fromNodeId: 'review-a2', toScreenId: 'review', label: 'Refresh batch' },
    { fromNodeId: 'approve-a0', toScreenId: 'receipt', label: 'Post to ledger-core' },
    { fromNodeId: 'approve-a1', toScreenId: 'audit', label: LONG_LABEL },
    { fromNodeId: 'receipt-a0', toScreenId: 'audit', label: 'Write audit entry' },
    { fromNodeId: 'audit-a0', toScreenId: 'triage', label: 'Back to queue' },
    { fromNodeId: 'settings-a0', toScreenId: 'audit', label: 'Open audit log' },
  ],
};

const SPARSE: WireframeDocument = {
  version: 1,
  initialScreenId: 'intake',
  theme: { name: 'acme' },
  screens: [
    screenOf({ id: 'intake', title: 'Intake', actions: 1 }),
    screenOf({ id: 'checks', title: 'Checks', actions: 1 }),
    screenOf({ id: 'done', title: 'Done', actions: 0 }),
  ],
  transitions: [
    { fromNodeId: 'intake-a0', toScreenId: 'checks', label: '' },
    { fromNodeId: 'checks-a0', toScreenId: 'done', label: 'Confirm and close the ledger period' },
  ],
};

const CYCLIC: WireframeDocument = {
  version: 1,
  initialScreenId: 'draft',
  theme: { name: 'acme' },
  screens: [
    screenOf({ id: 'draft', title: 'Draft', actions: 1 }),
    screenOf({ id: 'preview', title: 'Preview', actions: 1 }),
  ],
  transitions: [
    { fromNodeId: 'draft-a0', toScreenId: 'preview', label: 'Preview' },
    { fromNodeId: 'preview-a0', toScreenId: 'draft', label: 'Edit again' },
  ],
};

const layoutOf = ({ document }: { readonly document: WireframeDocument }): FlowLayout =>
  buildFlowLayout({ document, index: buildWireframeIndex({ document }) });

type Segment = Readonly<{ a: { x: number; y: number }; b: { x: number; y: number } }>;

const segmentsOf = ({ edge }: { readonly edge: FlowEdge }): ReadonlyArray<Segment> =>
  edge.points.slice(1).map((point, position) => ({
    a: edge.points[position] ?? point,
    b: point,
  }));

const spans = ({
  low,
  high,
  from,
  to,
}: {
  readonly low: number;
  readonly high: number;
  readonly from: number;
  readonly to: number;
}): boolean => Math.min(from, to) < high && low < Math.max(from, to);

const crossesBox = ({
  segment,
  box,
}: {
  readonly segment: Segment;
  readonly box: FlowBox;
}): boolean => {
  if (segment.a.y === segment.b.y) {
    return (
      segment.a.y > box.y &&
      segment.a.y < box.y + box.height &&
      spans({ low: box.x, high: box.x + box.width, from: segment.a.x, to: segment.b.x })
    );
  }

  return (
    segment.a.x > box.x &&
    segment.a.x < box.x + box.width &&
    spans({ low: box.y, high: box.y + box.height, from: segment.a.y, to: segment.b.y })
  );
};

const onRun = ({ label, run }: { readonly label: FlowLabel; readonly run: Segment }): boolean =>
  run.a.y > label.y &&
  run.a.y < label.y + label.height &&
  spans({ low: label.x, high: label.x + label.width, from: run.a.x, to: run.b.x });

const overlaps = ({
  a,
  b,
}: {
  readonly a: Readonly<{ x: number; y: number; width: number; height: number }>;
  readonly b: Readonly<{ x: number; y: number; width: number; height: number }>;
}): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const labelsOf = ({ layout }: { readonly layout: FlowLayout }): ReadonlyArray<FlowLabel> =>
  layout.edges.flatMap((edge) => (edge.label === null ? [] : [edge.label]));

const edgeByLabel = ({
  layout,
  text,
}: {
  readonly layout: FlowLayout;
  readonly text: string;
}): FlowEdge => {
  const found = layout.edges.find((edge) => edge.label?.text === text);
  if (found === undefined) {
    throw new Error(`no edge labelled ${text}`);
  }

  return found;
};

const boxOf = ({
  layout,
  screenId,
}: {
  readonly layout: FlowLayout;
  readonly screenId: string;
}): FlowBox => {
  const found = layout.boxes.find((box) => box.screenId === screenId);
  if (found === undefined) {
    throw new Error(`no box for ${screenId}`);
  }

  return found;
};

describe('buildFlowLayout', () => {
  it('ranks a linear flow into one straight spine of columns', () => {
    const layout = layoutOf({ document: SIMPLE });
    const ranks = layout.boxes.map((box) => box.rank);
    expect(ranks).toEqual([0, 1, 2, 3]);
    const tops = new Set(layout.boxes.map((box) => box.y));
    expect(tops.size).toBe(1);
    const xs = layout.boxes.map((box) => box.x);
    expect([...xs].sort((left, right) => left - right)).toEqual(xs);
  });

  it('draws a step between neighbours as a horizontal arrow into the side of the target', () => {
    const layout = layoutOf({ document: SIMPLE });
    const edge = edgeByLabel({ layout, text: 'Open workspace' });
    const from = boxOf({ layout, screenId: 'workspaces' });
    const to = boxOf({ layout, screenId: 'ledger' });
    expect(edge.kind).toBe('step');
    expect(edge.from.y).toBe(edge.to.y);
    expect(edge.from.x).toBe(from.x + from.width);
    expect(edge.to.x).toBe(to.x);
    expect(edge.path).toBe(`M ${edge.from.x} ${edge.from.y} L ${edge.to.x} ${edge.to.y}`);
  });

  it('keeps a step label inside the gap it belongs to, above its own run', () => {
    const layout = layoutOf({ document: SIMPLE });
    const edge = edgeByLabel({ layout, text: 'Open workspace' });
    const from = boxOf({ layout, screenId: 'workspaces' });
    const to = boxOf({ layout, screenId: 'ledger' });
    const label = edge.label;
    expect(label).not.toBeNull();
    if (label === null) {
      return;
    }
    expect(label.x).toBeGreaterThanOrEqual(from.x + from.width);
    expect(label.x + label.width).toBeLessThanOrEqual(to.x);
    expect(label.y + label.height).toBeLessThanOrEqual(edge.from.y);
  });

  it('routes a skip above every box and a back edge below every box', () => {
    const layout = layoutOf({ document: HARD });
    const top = Math.min(...layout.boxes.map((box) => box.y));
    const bottom = Math.max(...layout.boxes.map((box) => box.y + box.height));
    const skip = edgeByLabel({ layout, text: 'Resume last batch' });
    const back = edgeByLabel({ layout, text: 'Back to queue' });
    expect(skip.kind).toBe('skip');
    expect(back.kind).toBe('back');
    expect(skip.laneY).not.toBeNull();
    expect(back.laneY).not.toBeNull();
    expect(skip.laneY ?? 0).toBeLessThan(top);
    expect(back.laneY ?? 0).toBeGreaterThan(bottom);
    expect(back.to.x).toBeLessThan(back.from.x);
  });

  it('closes a self transition on the top edge of its own screen', () => {
    const layout = layoutOf({ document: HARD });
    const edge = edgeByLabel({ layout, text: 'Refresh batch' });
    const box = boxOf({ layout, screenId: 'review' });
    expect(edge.kind).toBe('self');
    expect(edge.from.y).toBe(box.y);
    expect(edge.to.y).toBe(box.y);
    expect(edge.from.x).not.toBe(edge.to.x);
    expect(edge.from.x).toBeGreaterThanOrEqual(box.x);
    expect(edge.to.x).toBeLessThanOrEqual(box.x + box.width);
    expect(edge.laneY ?? 0).toBeLessThan(box.y);
  });

  it('fans two edges between the same pair onto separate runs and separate labels', () => {
    const layout = layoutOf({ document: HARD });
    const first = edgeByLabel({ layout, text: 'Approve' });
    const second = edgeByLabel({ layout, text: 'Approve with override' });
    expect(first.from.y).not.toBe(second.from.y);
    expect(first.to.y).not.toBe(second.to.y);
    expect(first.label?.y).not.toBe(second.label?.y);
  });

  it('fans several outgoing and several incoming edges onto distinct anchors', () => {
    const layout = layoutOf({ document: HARD });
    const intoAudit = layout.edges.filter((edge) => edge.toScreenId === 'audit');
    expect(intoAudit.length).toBe(3);
    expect(new Set(intoAudit.map((edge) => `${edge.to.x},${edge.to.y}`)).size).toBe(3);
    const outOfReview = layout.edges.filter(
      (edge) => edge.fromScreenId === 'review' && edge.toScreenId !== 'review',
    );
    expect(new Set(outOfReview.map((edge) => `${edge.from.x},${edge.from.y}`)).size).toBe(
      outOfReview.length,
    );
  });

  it('truncates a long label and keeps the full text reachable', () => {
    const layout = layoutOf({ document: HARD });
    const long = layout.edges.find((edge) => edge.label?.full === LONG_LABEL);
    expect(long).toBeDefined();
    expect(long?.label?.text.endsWith('…')).toBe(true);
    expect((long?.label?.text.length ?? 0) < LONG_LABEL.length).toBe(true);
  });

  it('never lets two labels overlap and never puts a label on a screen', () => {
    for (const document of [SIMPLE, HARD, SPARSE, CYCLIC]) {
      const layout = layoutOf({ document });
      const labels = labelsOf({ layout });
      expect(labels.length).toBeGreaterThan(0);
      labels.forEach((label, position) => {
        labels.slice(position + 1).forEach((other) => {
          expect(overlaps({ a: label, b: other })).toBe(false);
        });
        layout.boxes.forEach((box) => {
          expect(overlaps({ a: label, b: box })).toBe(false);
        });
      });
    }
  });

  it('rises and falls between columns so no edge ever crosses a screen', () => {
    for (const document of [SIMPLE, HARD, SPARSE, CYCLIC]) {
      const layout = layoutOf({ document });
      const crossings = layout.edges.flatMap((edge) =>
        segmentsOf({ edge }).flatMap((segment) =>
          layout.boxes
            .filter((box) => crossesBox({ segment, box }))
            .map((box) => `${edge.label?.text ?? edge.key} over ${box.screenId}`),
        ),
      );
      expect(crossings).toEqual([]);
    }
  });

  it('never lets a label sit on a connector', () => {
    for (const document of [SIMPLE, HARD, SPARSE, CYCLIC]) {
      const layout = layoutOf({ document });
      const runs = layout.edges.flatMap((edge) =>
        segmentsOf({ edge }).filter((segment) => segment.a.y === segment.b.y),
      );
      expect(runs.length).toBeGreaterThan(0);
      const collisions = labelsOf({ layout }).flatMap((label) =>
        runs
          .filter((run) => onRun({ label, run }))
          .map((run) => `${label.text} on the run at y ${run.a.y}`),
      );
      expect(collisions).toEqual([]);
    }
  });

  it('stacks a busy gap upward instead of down onto the spine', () => {
    const layout = layoutOf({ document: HARD });
    const first = edgeByLabel({ layout, text: 'Open batch' });
    const second = edgeByLabel({ layout, text: 'Configure notify-relay' });
    const floor = Math.min(first.from.y, first.to.y, second.from.y, second.to.y);
    for (const edge of [first, second]) {
      expect((edge.label?.y ?? 0) + (edge.label?.height ?? 0)).toBeLessThan(floor);
    }
    expect(first.label?.y).not.toBe(second.label?.y);
  });

  it('finds the main line as the spine and gives each other kind its own role', () => {
    const layout = layoutOf({ document: HARD });
    const spine = layout.edges
      .filter((edge) => edge.role === 'spine')
      .map((edge) => `${edge.fromScreenId}-${edge.toScreenId}`);
    expect(spine).toEqual([
      'launch-triage',
      'triage-review',
      'review-approve',
      'approve-receipt',
      'receipt-audit',
    ]);
    expect(edgeByLabel({ layout, text: 'Approve with override' }).role).toBe('branch');
    expect(edgeByLabel({ layout, text: 'Configure notify-relay' }).role).toBe('branch');
    expect(edgeByLabel({ layout, text: 'Resume last batch' }).role).toBe('skip');
    expect(edgeByLabel({ layout, text: 'Back to queue' }).role).toBe('back');
    expect(edgeByLabel({ layout, text: 'Refresh batch' }).role).toBe('self');
    expect(layoutOf({ document: SIMPLE }).edges.every((edge) => edge.role === 'spine')).toBe(true);
  });

  it('shrinks a gap that carries nothing and grows only the one that does', () => {
    const layout = layoutOf({ document: SPARSE });
    const intake = boxOf({ layout, screenId: 'intake' });
    const checks = boxOf({ layout, screenId: 'checks' });
    const done = boxOf({ layout, screenId: 'done' });
    const bare = checks.x - (intake.x + intake.width);
    const carried = done.x - (checks.x + checks.width);
    expect(bare).toBe(56);
    expect(carried).toBeGreaterThan(bare);
    const label = edgeByLabel({ layout, text: 'Confirm and close the ledger period' }).label;
    expect(carried).toBe((label?.width ?? 0) + 14);
  });

  it('keeps every label inside the viewBox', () => {
    const layout = layoutOf({ document: HARD });
    for (const label of labelsOf({ layout })) {
      expect(label.x).toBeGreaterThanOrEqual(layout.left);
      expect(label.x + label.width).toBeLessThanOrEqual(layout.left + layout.width);
      expect(label.y).toBeGreaterThanOrEqual(layout.top);
      expect(label.y + label.height).toBeLessThanOrEqual(layout.top + layout.height);
    }
  });

  it('lays a long flow out in one line wider than the pane instead of wrapping it', () => {
    const layout = layoutOf({ document: HARD });
    expect(layout.width).toBeGreaterThan(900);
    expect(new Set(layout.boxes.map((box) => box.rank)).size).toBe(6);
  });

  it('survives a cycle without hanging the ranker', () => {
    const layout = layoutOf({ document: CYCLIC });
    expect(layout.boxes.map((box) => box.rank)).toEqual([0, 1]);
    expect(layout.edges.map((edge) => edge.kind)).toEqual(['step', 'back']);
  });
});

describe('WireframeFlowOverview', () => {
  afterEach(() => {
    cleanup();
  });

  it('tells edge kinds apart by line style and a label glyph, never by colour', () => {
    const { container } = render(
      <WireframeFlowOverview
        document={HARD}
        index={buildWireframeIndex({ document: HARD })}
        currentScreenId="approve"
        onSelectScreen={() => undefined}
      />,
    );
    const markup = container.innerHTML;
    for (const role of ['spine', 'branch', 'skip', 'back', 'self']) {
      expect(markup).toContain(`wireframe-flow-arrow-${role}`);
    }
    expect(markup).not.toMatch(/stroke-(?:info|warning|merged|danger)/);
    expect(markup).not.toMatch(/fill-(?:info|warning|merged|danger)/);
    const dashes = [...container.querySelectorAll('path[stroke-dasharray]')].map((path) =>
      path.getAttribute('stroke-dasharray'),
    );
    expect([...new Set(dashes)].sort()).toEqual(['1.5 3', '4 4']);
    expect(container.textContent).toContain('\u21a9 Back to queue');
    expect(container.textContent).toContain('\u21bb Refresh batch');
    expect(/#[0-9a-fA-F]{3}\b/.test(markup)).toBe(false);
  });

  it('keeps the test id, the accessible names and keyboard selection', () => {
    const onSelectScreen = vi.fn();
    render(
      <WireframeFlowOverview
        document={SIMPLE}
        index={buildWireframeIndex({ document: SIMPLE })}
        currentScreenId="sign-in"
        onSelectScreen={onSelectScreen}
      />,
    );
    expect(screen.getByTestId('wireframe-flow-overview')).toBeDefined();
    const target = screen.getByRole('button', { name: 'Go to Ledger Board' });
    fireEvent.keyDown(target, { key: 'Enter' });
    expect(onSelectScreen).toHaveBeenCalledWith('ledger');
    fireEvent.click(screen.getByRole('button', { name: 'Go to Entry Detail' }));
    expect(onSelectScreen).toHaveBeenCalledWith('entry');
  });
});
