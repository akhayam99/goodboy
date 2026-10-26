import type { WireframeDocument } from '@goodboy/core';

export const SAMPLE_WIREFRAME_DOCUMENT: WireframeDocument = {
  version: 2,
  initialScreenId: 'deliveries',
  theme: { name: 'generic', font: 'sans', radius: 'md' },
  screens: [
    {
      id: 'deliveries',
      title: 'Deliveries',
      viewport: 'desktop',
      root: {
        id: 'deliveries-root',
        kind: 'stack',
        direction: 'column',
        gap: 'md',
        padding: 'md',
        children: [
          { id: 'deliveries-title', kind: 'text', text: 'Webhook deliveries', variant: 'title' },
          {
            id: 'deliveries-note',
            kind: 'text',
            text: 'Low fidelity sketch of the deliveries screen.',
            variant: 'caption',
          },
          {
            id: 'deliveries-table',
            kind: 'table',
            columns: ['Event', 'Attempts', 'State'],
            rows: [
              ['invoice.paid', '1', 'Delivered'],
              ['invoice.paid', '3', 'Retrying'],
              ['payout.held', '5', 'Stuck'],
            ],
          },
          {
            id: 'deliveries-open',
            kind: 'button',
            label: 'Open the stuck delivery',
            variant: 'primary',
            action: { type: 'navigate', toScreenId: 'delivery' },
          },
        ],
      },
    },
    {
      id: 'delivery',
      title: 'Stuck delivery',
      viewport: 'desktop',
      root: {
        id: 'delivery-root',
        kind: 'stack',
        direction: 'column',
        gap: 'md',
        padding: 'md',
        children: [
          { id: 'delivery-title', kind: 'text', text: 'payout.held', variant: 'title' },
          {
            id: 'delivery-body',
            kind: 'text',
            text: 'Five attempts, the last one timed out after 30 seconds.',
            variant: 'body',
          },
          {
            id: 'delivery-back',
            kind: 'button',
            label: 'Back to deliveries',
            variant: 'secondary',
            action: { type: 'navigate', toScreenId: 'deliveries' },
          },
        ],
      },
    },
  ],
  transitions: [
    { fromNodeId: 'deliveries-open', toScreenId: 'delivery', label: 'open a stuck delivery' },
    { fromNodeId: 'delivery-back', toScreenId: 'deliveries', label: 'back to the list' },
  ],
};
