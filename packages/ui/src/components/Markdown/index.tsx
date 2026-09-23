import { Fragment, memo, useMemo, type ReactNode } from 'react';
import { Square, SquareCheck, SquareMinus, type LucideIcon } from 'lucide-react';
import { cn } from '../../cn';
import { RemoteImage } from '../RemoteImage';
import { LocalImage } from '../LocalImage';
import { ctxStyleForTag, ctxTagLabel } from './ctxTagStyle';
import { parseInline, type InlineNode } from './parseInline';
import {
  parseMarkdown,
  type Block,
  type CellAlign,
  type KitEntry,
  type TaskState,
} from './parseMarkdown';
import { tokenizeCode, type CodeToken, type CodeTokenKind } from './tokenizeCode';

type MarkdownVariant = 'document' | 'preview';

type MarkdownProps = {
  readonly text: string;
  readonly className?: string;
  readonly variant?: MarkdownVariant;
};

const CHIP_CLASS =
  'mx-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 align-baseline text-[0.7em] font-semibold uppercase tracking-wide';

const INLINE_CODE_CLASS: Record<MarkdownVariant, string> = {
  document: 'rounded-md bg-muted px-1 py-0 font-mono text-[0.875em] text-foreground wrap-anywhere',
  preview: 'font-mono text-[0.875em] text-foreground wrap-anywhere',
};

const CODE_TOKEN_CLASS: Record<CodeTokenKind, string> = {
  plain: '',
  comment: 'text-syntax-comment',
  string: 'text-syntax-string',
  property: 'text-syntax-property',
  number: 'text-syntax-number',
  keyword: 'text-syntax-keyword',
  added: 'text-success',
  removed: 'text-danger',
};

type CodeContentParams = {
  readonly content: string;
  readonly lang: string | null;
  readonly key: string;
};

const renderCodeContent = ({ content, lang, key }: CodeContentParams): ReactNode => {
  const tokens = tokenizeCode({ code: content, lang });
  if (tokens === null) {
    return content;
  }
  return tokens.map((token: CodeToken, index) =>
    token.kind === 'plain' ? (
      <Fragment key={`${key}-t${index}`}>{token.text}</Fragment>
    ) : (
      <span key={`${key}-t${index}`} className={CODE_TOKEN_CLASS[token.kind]}>
        {token.text}
      </span>
    ),
  );
};

type ImageParams = {
  readonly alt: string;
  readonly url: string;
  readonly key: string;
  readonly variant: MarkdownVariant;
};

const renderImage = ({ alt, url, key, variant }: ImageParams): ReactNode => {
  if (/^data:image\/svg/i.test(url)) {
    return alt;
  }
  if (/^data:image\//i.test(url)) {
    return (
      <img
        key={key}
        src={url}
        alt={alt}
        className="my-1.5 max-h-96 max-w-full rounded-md border border-border-soft object-contain"
      />
    );
  }
  if (/^data:/i.test(url)) {
    return alt;
  }
  if (variant === 'preview') {
    return alt;
  }
  if (!/^https?:/i.test(url)) {
    if (
      url.length <= 1024 &&
      !/\s/.test(url) &&
      !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url) &&
      /\.(?:png|jpe?g|gif|webp)$/i.test(url)
    ) {
      return <LocalImage key={`${key}-${url}`} url={url} alt={alt} />;
    }
    return alt;
  }
  return <RemoteImage key={key} url={url} alt={alt} />;
};

type InlineRenderParams = {
  readonly nodes: ReadonlyArray<InlineNode>;
  readonly keyPrefix: string;
  readonly variant: MarkdownVariant;
};

const renderInlineNodes = ({ nodes, keyPrefix, variant }: InlineRenderParams): ReactNode => {
  const out: ReactNode[] = nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (node.kind === 'text') {
      return node.value;
    }
    if (node.kind === 'code') {
      return (
        <code key={key} className={INLINE_CODE_CLASS[variant]}>
          {node.value}
        </code>
      );
    }
    if (node.kind === 'chip') {
      const style = ctxStyleForTag({ tag: node.tag });
      const Icon = style.icon;
      return (
        <span
          key={key}
          data-block="chip"
          data-tone={style.label}
          data-color={style.tone}
          data-labelled={node.label !== null ? 'true' : undefined}
          className={cn(CHIP_CLASS, node.label !== null && 'normal-case', style.chipClass)}
        >
          <Icon size={10} aria-hidden />
          {node.label ?? style.label}
        </span>
      );
    }
    if (node.kind === 'strong') {
      return (
        <strong key={key} className="font-semibold">
          {renderInlineNodes({ nodes: node.children, keyPrefix: `${key}-b`, variant })}
        </strong>
      );
    }
    if (node.kind === 'em') {
      return (
        <em key={key}>
          {renderInlineNodes({ nodes: node.children, keyPrefix: `${key}-i`, variant })}
        </em>
      );
    }
    if (node.kind === 'del') {
      return (
        <del key={key} className="text-muted-foreground">
          {renderInlineNodes({ nodes: node.children, keyPrefix: `${key}-s`, variant })}
        </del>
      );
    }
    if (node.kind === 'image') {
      return renderImage({ alt: node.alt, url: node.url, key, variant });
    }
    return (
      <a
        key={key}
        href={node.url}
        target="_blank"
        rel="noreferrer noopener"
        className="text-primary underline-offset-2 hover:underline"
      >
        {renderInlineNodes({ nodes: node.children, keyPrefix: `${key}-l`, variant })}
      </a>
    );
  });

  return out.length === 1 ? out[0] : <>{out}</>;
};

const renderInline = (input: string, keyPrefix: string, variant: MarkdownVariant): ReactNode =>
  renderInlineNodes({ nodes: parseInline({ text: input }), keyPrefix, variant });

const HEADING_CLASS: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
  1: 'text-lg font-semibold leading-snug text-foreground',
  2: 'text-base font-semibold leading-snug text-foreground',
  3: 'text-sm font-semibold leading-snug text-foreground',
  4: 'text-xs font-semibold uppercase leading-snug tracking-eyebrow text-muted-foreground',
  5: 'text-2xs font-semibold uppercase leading-snug tracking-eyebrow text-muted-foreground',
  6: 'text-2xs font-semibold uppercase leading-snug tracking-eyebrow text-muted-foreground',
};

const TASK_ICON: Record<TaskState, LucideIcon> = {
  open: Square,
  done: SquareCheck,
  partial: SquareMinus,
};

const TASK_LABEL: Record<TaskState, string> = {
  open: 'open task',
  done: 'done task',
  partial: 'partly done task',
};

const TASK_ICON_CLASS: Record<TaskState, string> = {
  open: 'text-muted-foreground',
  done: 'text-success',
  partial: 'text-warning',
};

type TaskMarkParams = {
  readonly task: TaskState;
};

const renderTaskMark = ({ task }: TaskMarkParams): ReactNode => {
  const Icon = TASK_ICON[task];
  return (
    <Icon
      size={13}
      role="img"
      aria-label={TASK_LABEL[task]}
      data-block="task-mark"
      className={cn('absolute -left-5 top-[0.3em]', TASK_ICON_CLASS[task])}
    />
  );
};

const PREVIEW_LINE_CLASS = 'truncate font-mono text-xs text-muted-foreground';

type KitPreviewParams = {
  readonly key: string;
  readonly entries: ReadonlyArray<KitEntry>;
};

const renderKitPreview = ({ key, entries }: KitPreviewParams): ReactNode => (
  <div key={key} className={PREVIEW_LINE_CLASS}>
    {entries
      .map((entry) => (entry.label.length > 0 ? `${entry.label}: ${entry.value}` : entry.value))
      .join(' · ')}
  </div>
);

const alignClass = (align: CellAlign | undefined): string => {
  if (align === 'right') {
    return 'text-right';
  }
  if (align === 'center') {
    return 'text-center';
  }
  return 'text-left';
};

const firstMeaningfulLine = (value: string): string => {
  const line = value.split('\n').find((candidate) => candidate.trim().length > 0);
  return line === undefined ? '' : line.trim();
};

type RenderParams = {
  readonly block: Block;
  readonly id: string;
  readonly variant: MarkdownVariant;
  readonly depth: number;
};

const listClass = (variant: MarkdownVariant, depth: number): string => {
  if (variant === 'preview') {
    return 'flex flex-col gap-0.5 pl-4 marker:text-muted-foreground';
  }
  if (depth > 0) {
    return 'flex flex-col gap-1 pl-5 marker:text-faint-foreground';
  }
  return 'flex flex-col gap-1 pl-5 marker:text-muted-foreground';
};

const renderBlock = ({ block, id, variant, depth }: RenderParams): ReactNode => {
  const key = id;
  switch (block.kind) {
    case 'code': {
      if (variant === 'preview') {
        const line = firstMeaningfulLine(block.content);
        return (
          <div key={key} className={PREVIEW_LINE_CLASS}>
            {line.length > 0 ? line : (block.lang ?? 'code')}
          </div>
        );
      }
      return (
        <pre
          key={key}
          className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed text-foreground"
        >
          <code>{renderCodeContent({ content: block.content, lang: block.lang, key })}</code>
        </pre>
      );
    }
    case 'heading': {
      const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      const headingClass =
        variant === 'preview' ? 'font-semibold text-foreground' : HEADING_CLASS[block.level];
      return (
        <Tag key={key} className={cn(headingClass, 'wrap-anywhere')}>
          {renderInline(block.content, key, variant)}
        </Tag>
      );
    }
    case 'hr':
      return (
        <div
          key={key}
          role="separator"
          className="h-px w-full bg-gradient-to-r from-transparent via-border-soft to-transparent"
        />
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag
          key={key}
          className={cn(block.ordered ? 'list-decimal' : 'list-disc', listClass(variant, depth))}
        >
          {block.items.map((item, j) => (
            <li
              key={`${key}-${j}`}
              data-task={item.task ?? undefined}
              className={cn(
                'leading-relaxed wrap-anywhere',
                item.task !== null && 'relative list-none',
              )}
            >
              {item.task !== null && renderTaskMark({ task: item.task })}
              {item.children.length === 0 ? (
                renderInline(item.content, `${key}-${j}`, variant)
              ) : (
                <div className="flex flex-col gap-1">
                  <div>{renderInline(item.content, `${key}-${j}`, variant)}</div>
                  {item.children.map((child, ci) =>
                    renderBlock({
                      block: child,
                      id: `${key}-${j}-c${ci}`,
                      variant,
                      depth: depth + 1,
                    }),
                  )}
                </div>
              )}
            </li>
          ))}
        </Tag>
      );
    }
    case 'quote':
      return (
        <blockquote
          key={key}
          className="flex flex-col gap-1.5 border-l-2 border-border-soft pl-3 leading-relaxed text-muted-foreground wrap-anywhere"
        >
          {block.lines.map((ln, j) => (
            <p key={`${key}-${j}`}>{renderInline(ln, `${key}-${j}`, variant)}</p>
          ))}
        </blockquote>
      );
    case 'table': {
      if (variant === 'preview') {
        return (
          <div key={key} className={PREVIEW_LINE_CLASS}>
            {block.headers.join(' | ')}
          </div>
        );
      }
      return (
        <div key={key} className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border-soft">
                {block.headers.map((h, j) => (
                  <th
                    key={`${key}-h-${j}`}
                    className={cn(
                      'px-3 py-1.5 text-2xs font-semibold uppercase tracking-eyebrow text-muted-foreground wrap-anywhere',
                      alignClass(block.align[j]),
                    )}
                  >
                    {renderInline(h, `${key}-h-${j}`, variant)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={`${key}-r-${ri}`} className="border-b border-border-soft last:border-b-0">
                  {row.map((cell, ci) => (
                    <td
                      key={`${key}-r-${ri}-c-${ci}`}
                      className={cn(
                        'px-3 py-1.5 align-top wrap-anywhere',
                        alignClass(block.align[ci]),
                      )}
                    >
                      {renderInline(cell, `${key}-r-${ri}-c-${ci}`, variant)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case 'callout': {
      const style = ctxStyleForTag({ tag: block.tag });
      const Icon = style.icon;
      const label = ctxTagLabel({ tag: block.tag });
      if (variant === 'preview') {
        return (
          <div key={key} className="flex min-w-0 items-center gap-1.5 text-sm">
            <span
              data-block="chip"
              data-tone={label}
              data-color={style.tone}
              className={cn(CHIP_CLASS, style.chipClass)}
            >
              <Icon size={10} aria-hidden />
              {label}
            </span>
            <span className="min-w-0 truncate text-muted-foreground">
              {firstMeaningfulLine(block.content)}
            </span>
          </div>
        );
      }
      return (
        <div
          key={key}
          data-block="callout"
          data-tone={label}
          data-color={style.tone}
          className={cn('flex flex-col gap-1.5 rounded-md border p-3', style.calloutClass)}
        >
          <div
            data-block="callout-label"
            className={cn(
              'inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-eyebrow',
              style.calloutLabelClass,
            )}
          >
            <Icon size={11} aria-hidden className={style.iconClass} />
            {label}
          </div>
          <div
            data-block="callout-body"
            className="flex flex-col gap-2 leading-relaxed text-foreground wrap-anywhere"
          >
            {block.blocks.map((child, ci) =>
              renderBlock({ block: child, id: `${key}-c${ci}`, variant, depth }),
            )}
          </div>
        </div>
      );
    }
    case 'facts': {
      if (variant === 'preview') {
        return renderKitPreview({ key, entries: block.entries });
      }
      return (
        <dl
          key={key}
          data-block="facts"
          className="grid grid-cols-[minmax(6rem,max-content)_1fr] gap-x-5 gap-y-1.5"
        >
          {block.entries.map((entry, ei) => (
            <Fragment key={`${key}-f${ei}`}>
              <dt className="pt-px text-2xs font-semibold uppercase leading-5 tracking-eyebrow text-muted-foreground">
                {renderInline(entry.label, `${key}-f${ei}-l`, variant)}
              </dt>
              <dd className="min-w-0 leading-relaxed text-foreground wrap-anywhere">
                {renderInline(entry.value, `${key}-f${ei}-v`, variant)}
                {entry.hint !== null && (
                  <span className="text-muted-foreground">
                    {' · '}
                    {renderInline(entry.hint, `${key}-f${ei}-h`, variant)}
                  </span>
                )}
              </dd>
            </Fragment>
          ))}
        </dl>
      );
    }
    case 'metrics': {
      if (variant === 'preview') {
        return renderKitPreview({ key, entries: block.entries });
      }
      return (
        <div
          key={key}
          data-block="metrics"
          className="grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-2"
        >
          {block.entries.map((entry, ei) => (
            <div
              key={`${key}-m${ei}`}
              data-block="metric"
              className="flex min-w-0 flex-col gap-0.5 rounded-md border border-border-soft px-3 py-2.5"
            >
              <span className="text-2xs font-semibold uppercase tracking-eyebrow text-muted-foreground">
                {renderInline(entry.label, `${key}-m${ei}-l`, variant)}
              </span>
              <span
                data-block="metric-value"
                className="text-xl font-semibold leading-tight tracking-tight text-foreground tabular-nums wrap-anywhere"
              >
                {renderInline(entry.value, `${key}-m${ei}-v`, variant)}
              </span>
              {entry.hint !== null && (
                <span className="text-xs leading-snug text-muted-foreground">
                  {renderInline(entry.hint, `${key}-m${ei}-h`, variant)}
                </span>
              )}
            </div>
          ))}
        </div>
      );
    }
    case 'timeline': {
      if (variant === 'preview') {
        return renderKitPreview({ key, entries: block.entries });
      }
      return (
        <ol key={key} data-block="timeline" className="flex flex-col">
          {block.entries.map((entry, ei) => (
            <li
              key={`${key}-t${ei}`}
              data-block="timeline-entry"
              className="relative grid grid-cols-[minmax(4.5rem,max-content)_1fr] gap-x-4 pb-1.5 pl-4 last:pb-0"
            >
              <span
                aria-hidden
                data-block="timeline-dot"
                className="absolute left-0 top-[0.55em] size-1.5 rounded-full bg-primary"
              />
              <span className="font-mono text-[0.9em] leading-relaxed text-muted-foreground tabular-nums">
                {renderInline(entry.label, `${key}-t${ei}-l`, variant)}
              </span>
              <span className="min-w-0 leading-relaxed text-foreground wrap-anywhere">
                {renderInline(entry.value, `${key}-t${ei}-v`, variant)}
                {entry.hint !== null && (
                  <span className="text-muted-foreground">
                    {' · '}
                    {renderInline(entry.hint, `${key}-t${ei}-h`, variant)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      );
    }
    case 'pagebreak':
      if (variant === 'preview') {
        return null;
      }
      return (
        <div
          key={key}
          aria-hidden
          data-block="pagebreak"
          className="h-0 w-full border-t border-dashed border-border-soft"
        />
      );
    case 'paragraph': {
      return (
        <p
          key={key}
          data-block={block.isTree ? 'tree' : undefined}
          className={cn(
            'leading-relaxed',
            block.isTree && 'overflow-x-auto whitespace-pre-wrap font-mono',
            !block.isTree && 'wrap-anywhere',
          )}
        >
          {block.isTree
            ? renderInline(block.content, key, variant)
            : block.content.split('\n').map((line, lineIndex, lines) => (
                <Fragment key={`${key}-${lineIndex}`}>
                  {renderInline(line, `${key}-${lineIndex}`, variant)}
                  {lineIndex < lines.length - 1 && <br />}
                </Fragment>
              ))}
        </p>
      );
    }
  }
};

const MarkdownImpl = ({ text, className, variant = 'document' }: MarkdownProps) => {
  const document = useMemo(() => parseMarkdown({ text }), [text]);

  if (variant === 'preview') {
    return (
      <div className={cn('flex flex-col gap-1 text-sm text-foreground', className)}>
        {document.blocks.map((block, idx) =>
          renderBlock({ block, id: `b-${idx}`, variant, depth: 0 }),
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-5 text-sm text-foreground', className)}>
      {document.sections.map((section, si) => (
        <div key={`s-${si}`} className="flex flex-col gap-2.5">
          {section.map((block, bi) =>
            renderBlock({ block, id: `b-${si}-${bi}`, variant, depth: 0 }),
          )}
        </div>
      ))}
    </div>
  );
};

export const Markdown = memo(MarkdownImpl);
