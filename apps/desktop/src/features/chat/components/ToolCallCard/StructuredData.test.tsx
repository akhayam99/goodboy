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
    screen.getByText('content (500 chars)');
    screen.getByText(/^x{1,120}\.\.\./);
  });

  it('expands long string on click', () => {
    const long = 'a'.repeat(500);
    render(<StructuredData data={long} />);
    fireEvent.click(screen.getByText(/chars\)/));
    screen.getByText(long);
  });

  it('renders empty array as []', () => {
    const { container } = render(<StructuredData data={[]} />);
    expect(container.textContent).toBe('[]');
  });

  it('renders small primitive array as inline chips', () => {
    render(<StructuredData data={['a', 'b', 'c']} />);
    screen.getByText('a');
    screen.getByText('b');
    screen.getByText('c');
  });

  it('renders mixed-type primitive array as chips', () => {
    render(<StructuredData data={[1, true, 'x']} />);
    screen.getByText('1');
    screen.getByText('true');
    screen.getByText('x');
  });

  it('renders large primitive array with indices', () => {
    const arr = Array.from({ length: 10 }, (_, i) => `item-${i}`);
    render(<StructuredData data={arr} />);
    screen.getByText('0:');
    screen.getByText('9:');
  });

  it('renders non-primitive array with indices', () => {
    render(<StructuredData data={[{ a: 1 }, { b: 2 }]} />);
    screen.getByText('0:');
    screen.getByText('1:');
  });

  it('renders empty object as {}', () => {
    const { container } = render(<StructuredData data={{}} />);
    expect(container.textContent).toBe('{}');
  });

  it('renders object entries as key-value grid', () => {
    render(<StructuredData data={{ path: '/foo.ts', line: 42 }} />);
    screen.getByText('path');
    screen.getByText('/foo.ts');
    screen.getByText('line');
    screen.getByText('42');
  });

  it('caps recursion at depth 4 and falls back to raw JSON', () => {
    const nested = { a: { b: { c: { d: { e: 'deep' } } } } };
    render(<StructuredData data={nested} />);
    screen.getByText(/"e": "deep"/);
  });

  it('renders nested objects recursively within depth', () => {
    render(<StructuredData data={{ outer: { inner: 'val' } }} />);
    screen.getByText('outer');
    screen.getByText('inner');
    screen.getByText('val');
  });

  it('uses label for collapsible string fallback', () => {
    const long = 'z'.repeat(500);
    render(<StructuredData data={long} />);
    screen.getByText('string (500 chars)');
  });
});
