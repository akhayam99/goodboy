// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StructuredData } from './StructuredData';

afterEach(cleanup);

describe('StructuredData', () => {
  it('renders null as italic text', () => {
    const { container } = render(<StructuredData data={null} />);
    expect(container.textContent).toBe('null');
    expect(container.querySelector('.italic')).toBeTruthy();
  });

  it('renders undefined as italic text', () => {
    const { container } = render(<StructuredData data={undefined} />);
    expect(container.textContent).toBe('null');
  });

  it('renders boolean values', () => {
    const { container } = render(<StructuredData data={true} />);
    expect(container.textContent).toBe('true');
  });

  it('renders number values', () => {
    const { container } = render(<StructuredData data={42} />);
    expect(container.textContent).toBe('42');
  });

  it('renders short strings inline', () => {
    const { container } = render(<StructuredData data="hello world" />);
    expect(container.textContent).toBe('hello world');
  });

  it('renders long strings as collapsible with char count', () => {
    const long = 'x'.repeat(500);
    render(<StructuredData data={long} label="content" />);
    expect(screen.getByText('content (500 chars)')).toBeTruthy();
    expect(screen.getByText(/^x{1,120}\.\.\./)).toBeTruthy();
  });

  it('expands long string on click', () => {
    const long = 'a'.repeat(500);
    render(<StructuredData data={long} />);
    fireEvent.click(screen.getByText(/chars\)/));
    expect(screen.getByText(long)).toBeTruthy();
  });

  it('renders empty array as []', () => {
    const { container } = render(<StructuredData data={[]} />);
    expect(container.textContent).toBe('[]');
  });

  it('renders small primitive array as inline chips', () => {
    render(<StructuredData data={['a', 'b', 'c']} />);
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
    expect(screen.getByText('c')).toBeTruthy();
  });

  it('renders mixed-type primitive array as chips', () => {
    render(<StructuredData data={[1, true, 'x']} />);
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('true')).toBeTruthy();
    expect(screen.getByText('x')).toBeTruthy();
  });

  it('renders large primitive array with indices', () => {
    const arr = Array.from({ length: 10 }, (_, i) => `item-${i}`);
    render(<StructuredData data={arr} />);
    expect(screen.getByText('0:')).toBeTruthy();
    expect(screen.getByText('9:')).toBeTruthy();
  });

  it('renders non-primitive array with indices', () => {
    render(<StructuredData data={[{ a: 1 }, { b: 2 }]} />);
    expect(screen.getByText('0:')).toBeTruthy();
    expect(screen.getByText('1:')).toBeTruthy();
  });

  it('renders empty object as {}', () => {
    const { container } = render(<StructuredData data={{}} />);
    expect(container.textContent).toBe('{}');
  });

  it('renders object entries as key-value grid', () => {
    render(<StructuredData data={{ path: '/foo.ts', line: 42 }} />);
    expect(screen.getByText('path')).toBeTruthy();
    expect(screen.getByText('/foo.ts')).toBeTruthy();
    expect(screen.getByText('line')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('caps recursion at depth 4 and falls back to raw JSON', () => {
    const nested = { a: { b: { c: { d: { e: 'deep' } } } } };
    render(<StructuredData data={nested} />);
    expect(screen.getByText(/"e": "deep"/)).toBeTruthy();
  });

  it('renders nested objects recursively within depth', () => {
    render(<StructuredData data={{ outer: { inner: 'val' } }} />);
    expect(screen.getByText('outer')).toBeTruthy();
    expect(screen.getByText('inner')).toBeTruthy();
    expect(screen.getByText('val')).toBeTruthy();
  });

  it('uses label for collapsible string fallback', () => {
    const long = 'z'.repeat(500);
    render(<StructuredData data={long} />);
    expect(screen.getByText('string (500 chars)')).toBeTruthy();
  });
});
