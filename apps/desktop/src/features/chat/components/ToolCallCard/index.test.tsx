// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { TranscriptItem } from '../../utils/transcript-items';
import { ToolCallCard } from './index';

function tool(
  overrides: Partial<Extract<TranscriptItem, { kind: 'tool_call' }>> = {},
): Extract<TranscriptItem, { kind: 'tool_call' }> {
  return {
    kind: 'tool_call',
    key: 'tool-1',
    toolUseId: '1',
    toolName: 'read',
    input: { path: '/foo.ts' },
    output: 'file content',
    isError: false,
    ended: true,
    ...overrides,
  };
}

afterEach(cleanup);

describe('ToolCallCard', () => {
  it('renders collapsed with tool name', () => {
    render(<ToolCallCard item={tool()} />);
    expect(screen.getByText('read')).toBeTruthy();
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false');
  });

  it('shows structured input and output when expanded', () => {
    render(<ToolCallCard item={tool()} />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByText('/foo.ts')).toBeTruthy();
    expect(screen.getByText('file content')).toBeTruthy();
  });

  it('pulses the state icon while running', () => {
    render(<ToolCallCard item={tool({ ended: false, output: null })} />);
    const icon = screen.getByTestId('tool-state-icon');
    expect(icon.getAttribute('class')).toContain('animate-pulse');
    expect(icon.getAttribute('class')).toContain('text-warning');
  });

  it('colors the state icon green once it succeeded', () => {
    render(<ToolCallCard item={tool()} />);
    const icon = screen.getByTestId('tool-state-icon');
    expect(icon.getAttribute('class')).toContain('text-success');
    expect(icon.getAttribute('class')).not.toContain('animate-pulse');
  });

  it('colors the state icon red on error', () => {
    render(<ToolCallCard item={tool({ isError: true })} />);
    expect(screen.getByTestId('tool-state-icon').getAttribute('class')).toContain('text-danger');
  });

  it('has a single leading chevron as the expand affordance', () => {
    render(<ToolCallCard item={tool()} />);
    const chevron = screen.getByTestId('transcript-chevron');
    expect(chevron.getAttribute('class')).not.toContain('rotate-90');
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getAllByTestId('transcript-chevron')[0]!.getAttribute('class')).toContain(
      'rotate-90',
    );
  });

  it('shows error badge when isError', () => {
    render(<ToolCallCard item={tool({ isError: true })} />);
    expect(screen.getByText('error')).toBeTruthy();
  });

  it('appends the run duration to the header once the tool ends', () => {
    vi.useFakeTimers();
    const { rerender } = render(<ToolCallCard item={tool({ ended: false, output: null })} />);
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    rerender(<ToolCallCard item={tool()} />);
    expect(screen.getByText('2s')).toBeTruthy();
    vi.useRealTimers();
  });

  it('toggles between structured and raw json', () => {
    render(<ToolCallCard item={tool()} />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByTestId('raw-toggle').textContent).toBe('raw json');
    fireEvent.click(screen.getByTestId('raw-toggle'));
    expect(screen.getByTestId('raw-toggle').textContent).toBe('structured');
  });

  it('does not render output when still running', () => {
    render(<ToolCallCard item={tool({ ended: false, output: null })} />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByText('/foo.ts')).toBeTruthy();
    expect(screen.queryByText('file content')).toBeNull();
  });

  it('shows raw JSON input and output in raw mode', () => {
    render(<ToolCallCard item={tool({ input: { key: 'val' }, output: 'result' })} />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    fireEvent.click(screen.getByTestId('raw-toggle'));
    const pres = document.querySelectorAll('pre');
    expect(pres.length).toBe(2);
    expect(pres[0]!.textContent).toContain('"key"');
    expect(pres[0]!.textContent).toContain('"val"');
    expect(pres[1]!.textContent).toContain('result');
  });

  it('raw mode hides output when not ended', () => {
    render(<ToolCallCard item={tool({ ended: false, output: null })} />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    fireEvent.click(screen.getByTestId('raw-toggle'));
    const pres = document.querySelectorAll('pre');
    expect(pres.length).toBe(1);
  });

  it('handles null input gracefully', () => {
    render(<ToolCallCard item={tool({ input: null, output: 'ok' })} />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByText('null')).toBeTruthy();
  });

  it('renders nested object input in structured mode', () => {
    render(<ToolCallCard item={tool({ input: { nested: { deep: true } } })} />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByText('nested')).toBeTruthy();
    expect(screen.getByText('deep')).toBeTruthy();
    expect(screen.getByText('true')).toBeTruthy();
  });
});
