import type { CSSProperties, ReactElement } from 'react';
import type {
  WireframeAction,
  WireframeAlignment,
  WireframeJustification,
  WireframeNode,
  WireframeTextVariant,
} from '@goodboy/core';
import { SPACING_PX, type WireframePalette } from '../../wireframePalette';

export type WireframeNodeHandlers = Readonly<{
  palette: WireframePalette;
  isLowFidelity: boolean;
  selectedNodeId: string | null;
  hotspots: ReadonlySet<string>;
  onSelect: (nodeId: string) => void;
  onAction: (params: { readonly nodeId: string; readonly action: WireframeAction | null }) => void;
}>;

type Props = WireframeNodeHandlers & {
  readonly node: WireframeNode;
};

type NodeElementParams = Readonly<{
  node: WireframeNode;
  handlers: WireframeNodeHandlers;
}>;

const ALIGN: Record<WireframeAlignment, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

const JUSTIFY: Record<WireframeJustification, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
};

const TEXT_STYLE: Record<WireframeTextVariant, CSSProperties> = {
  title: { fontSize: 22, fontWeight: 600, lineHeight: 1.2 },
  subtitle: { fontSize: 16, fontWeight: 500, lineHeight: 1.3 },
  body: { fontSize: 13, fontWeight: 400, lineHeight: 1.5 },
  caption: { fontSize: 11, fontWeight: 400, lineHeight: 1.4 },
  label: { fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' },
};

const RATIO: Record<string, number> = {
  square: 1,
  wide: 16 / 9,
  tall: 3 / 4,
  avatar: 1,
};

const Annotation = ({ note, color }: { readonly note: string; readonly color: string }) => (
  <span style={{ fontSize: 10, fontStyle: 'italic', color }} data-testid="wireframe-annotation">
    {note}
  </span>
);

const nodeElement = ({ node, handlers }: NodeElementParams): ReactElement => {
  const { palette, isLowFidelity, selectedNodeId, hotspots, onSelect, onAction } = handlers;
  const isSelected = selectedNodeId === node.id;
  const outline: CSSProperties = isSelected
    ? { outline: `2px solid ${palette.accent}`, outlineOffset: 2 }
    : {};
  const select = () => onSelect(node.id);

  if (node.kind === 'stack') {
    return (
      <div
        data-node-id={node.id}
        data-node-kind="stack"
        onClick={(event) => {
          event.stopPropagation();
          select();
        }}
        style={{
          display: 'flex',
          flexDirection: node.direction === 'row' ? 'row' : 'column',
          gap: SPACING_PX[node.gap ?? 'md'],
          padding: SPACING_PX[node.padding ?? 'none'],
          alignItems: ALIGN[node.align ?? 'stretch'],
          justifyContent: JUSTIFY[node.justify ?? 'start'],
          ...(node.surface === true
            ? {
                background: palette.surface,
                border: `1px solid ${palette.border}`,
                borderRadius: palette.radius,
              }
            : {}),
          ...outline,
        }}
      >
        {node.children.map((child) => (
          <WireframeNodeView key={child.id} node={child} {...handlers} />
        ))}
      </div>
    );
  }

  if (node.kind === 'grid') {
    return (
      <div
        data-node-id={node.id}
        data-node-kind="grid"
        onClick={(event) => {
          event.stopPropagation();
          select();
        }}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${node.columns}, minmax(0, 1fr))`,
          alignItems: 'start',
          gap: SPACING_PX[node.gap ?? 'md'],
          padding: SPACING_PX[node.padding ?? 'none'],
          ...outline,
        }}
      >
        {node.children.map((child) => (
          <WireframeNodeView key={child.id} node={child} {...handlers} />
        ))}
      </div>
    );
  }

  if (node.kind === 'text') {
    return (
      <p
        data-node-id={node.id}
        data-node-kind="text"
        onClick={(event) => {
          event.stopPropagation();
          select();
        }}
        style={{
          margin: 0,
          color: node.variant === 'caption' ? palette.muted : palette.foreground,
          ...TEXT_STYLE[node.variant ?? 'body'],
          ...outline,
        }}
      >
        {node.text}
      </p>
    );
  }

  if (node.kind === 'button') {
    const isHotspot = hotspots.has(node.id);
    const isPrimary = node.variant === 'primary';
    const isGhost = node.variant === 'ghost';
    const background = isPrimary ? palette.accent : isGhost ? 'transparent' : palette.surface;
    const foreground = isPrimary ? palette.accentForeground : palette.foreground;
    return (
      <button
        type="button"
        data-node-id={node.id}
        data-node-kind="button"
        data-hotspot={isHotspot ? 'true' : 'false'}
        onClick={(event) => {
          event.stopPropagation();
          select();
          onAction({ nodeId: node.id, action: node.action ?? null });
        }}
        style={{
          alignSelf: 'flex-start',
          padding: '7px 14px',
          fontSize: 12,
          fontWeight: 500,
          cursor: isHotspot ? 'pointer' : 'default',
          borderRadius: palette.radius,
          border: `1px solid ${isGhost ? 'transparent' : palette.border}`,
          background,
          color: node.variant === 'danger' ? palette.danger : foreground,
          ...outline,
        }}
      >
        {node.label}
      </button>
    );
  }

  if (node.kind === 'input') {
    const isArea = node.inputType === 'textarea';
    const isCheckbox = node.inputType === 'checkbox';
    return (
      <div
        data-node-id={node.id}
        data-node-kind="input"
        onClick={(event) => {
          event.stopPropagation();
          select();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 4, ...outline }}
      >
        {node.label === undefined ? null : (
          <span style={{ fontSize: 11, fontWeight: 500, color: palette.foreground }}>
            {node.label}
          </span>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            minHeight: isArea ? 64 : isCheckbox ? 18 : 30,
            width: isCheckbox ? 18 : 'auto',
            padding: isCheckbox ? 0 : '6px 10px',
            fontSize: 12,
            borderRadius: isCheckbox ? 4 : palette.radius,
            border: `1px solid ${palette.border}`,
            background: palette.surface,
            color: palette.muted,
          }}
        >
          {isCheckbox ? null : <span>{node.placeholder ?? node.inputType}</span>}
          {node.inputType === 'select' ? <span aria-hidden>v</span> : null}
        </div>
        {node.options === undefined || node.options.length === 0 ? null : (
          <span style={{ fontSize: 10, color: palette.muted }}>{node.options.join(' / ')}</span>
        )}
      </div>
    );
  }

  if (node.kind === 'list') {
    return (
      <ul
        data-node-id={node.id}
        data-node-kind="list"
        onClick={(event) => {
          event.stopPropagation();
          select();
        }}
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${palette.border}`,
          borderRadius: palette.radius,
          background: palette.surface,
          overflow: 'hidden',
          ...outline,
        }}
      >
        {node.items.map((item, index) => {
          const isHotspot = hotspots.has(item.id);
          return (
            <li key={item.id}>
              <button
                type="button"
                data-node-id={item.id}
                data-node-kind="list-item"
                data-hotspot={isHotspot ? 'true' : 'false'}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(item.id);
                  onAction({ nodeId: item.id, action: item.action ?? null });
                }}
                style={{
                  display: 'flex',
                  width: '100%',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 2,
                  padding: '8px 10px',
                  textAlign: 'left',
                  cursor: isHotspot ? 'pointer' : 'default',
                  background: 'transparent',
                  border: 'none',
                  borderTop: index === 0 ? 'none' : `1px solid ${palette.border}`,
                  color: palette.foreground,
                  ...(selectedNodeId === item.id
                    ? { outline: `2px solid ${palette.accent}`, outlineOffset: -2 }
                    : {}),
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 500 }}>{item.title}</span>
                {item.subtitle === undefined ? null : (
                  <span style={{ fontSize: 11, color: palette.muted }}>{item.subtitle}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  if (node.kind === 'table') {
    return (
      <table
        data-node-id={node.id}
        data-node-kind="table"
        onClick={(event) => {
          event.stopPropagation();
          select();
        }}
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 11,
          color: palette.foreground,
          border: `1px solid ${palette.border}`,
          borderRadius: palette.radius,
          background: palette.surface,
          ...outline,
        }}
      >
        <thead>
          <tr>
            {node.columns.map((column) => (
              <th
                key={column}
                style={{
                  textAlign: 'left',
                  padding: '6px 8px',
                  fontWeight: 600,
                  borderBottom: `1px solid ${palette.border}`,
                  color: palette.muted,
                }}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {node.rows.map((row, rowIndex) => (
            <tr key={`${node.id}-row-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td
                  key={`${node.id}-cell-${rowIndex}-${cellIndex}`}
                  style={{ padding: '6px 8px', borderTop: `1px solid ${palette.border}` }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (node.kind === 'image') {
    const ratio = RATIO[node.ratio ?? 'wide'] ?? 16 / 9;
    return (
      <div
        data-node-id={node.id}
        data-node-kind="image"
        role="img"
        aria-label={`${node.alt} (placeholder)`}
        onClick={(event) => {
          event.stopPropagation();
          select();
        }}
        style={{
          position: 'relative',
          width: node.ratio === 'avatar' ? 48 : '100%',
          aspectRatio: `${ratio}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: node.ratio === 'avatar' ? 999 : palette.radius,
          border: `1px dashed ${palette.border}`,
          background: isLowFidelity ? '#e4e4e7' : palette.background,
          color: palette.muted,
          fontSize: 10,
          overflow: 'hidden',
        }}
      >
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35 }}
        >
          <line x1="0" y1="0" x2="100" y2="100" stroke={palette.border} strokeWidth="1" />
          <line x1="100" y1="0" x2="0" y2="100" stroke={palette.border} strokeWidth="1" />
        </svg>
        <span style={{ position: 'relative', padding: '0 6px', textAlign: 'center' }}>
          {node.alt}
        </span>
      </div>
    );
  }

  const isRow = node.variant === 'top' || node.variant === 'tabs' || node.variant === 'bottom';
  return (
    <nav
      data-node-id={node.id}
      data-node-kind="navigation"
      onClick={(event) => {
        event.stopPropagation();
        select();
      }}
      style={{
        display: 'flex',
        flexDirection: isRow ? 'row' : 'column',
        gap: 4,
        padding: 6,
        borderRadius: palette.radius,
        border: `1px solid ${palette.border}`,
        background: palette.surface,
        ...outline,
      }}
    >
      {node.items.map((item) => {
        const isHotspot = hotspots.has(item.id);
        return (
          <button
            key={item.id}
            type="button"
            data-node-id={item.id}
            data-node-kind="navigation-item"
            data-hotspot={isHotspot ? 'true' : 'false'}
            aria-current={item.isActive === true ? 'page' : undefined}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(item.id);
              onAction({ nodeId: item.id, action: item.action ?? null });
            }}
            style={{
              padding: '5px 10px',
              fontSize: 11,
              fontWeight: item.isActive === true ? 600 : 400,
              cursor: isHotspot ? 'pointer' : 'default',
              borderRadius: palette.radius,
              border: 'none',
              background: item.isActive === true ? palette.background : 'transparent',
              color: item.isActive === true ? palette.foreground : palette.muted,
              ...(selectedNodeId === item.id
                ? { outline: `2px solid ${palette.accent}`, outlineOffset: -2 }
                : {}),
            }}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
};

export const WireframeNodeView = ({ node, ...handlers }: Props) => {
  const element = nodeElement({ node, handlers });
  const note = node.note ?? null;
  if (note === null) {
    return element;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {element}
      <Annotation note={note} color={handlers.palette.muted} />
    </div>
  );
};
