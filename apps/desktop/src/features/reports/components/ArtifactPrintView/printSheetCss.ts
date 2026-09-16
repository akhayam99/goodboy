export const PRINT_SHEET_CSS = `
@page {
  margin: 20mm 24mm;
}
.print-sheet {
  background: #ffffff;
  color: #14161a;
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 10.5pt;
  line-height: 1.6;
  margin: 0 auto;
  max-width: 42rem;
  overflow-wrap: anywhere;
  padding: 2.5rem 2.25rem 3rem;
}
.print-sheet .print-letterhead {
  display: block;
}
.print-sheet .print-eyebrow {
  align-items: baseline;
  display: flex;
  justify-content: space-between;
}
.print-sheet .print-kind {
  color: #6b7079;
  font-size: 8pt;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}
.print-sheet .print-wordmark {
  align-items: center;
  color: #14161a;
  display: inline-flex;
  font-size: 9.5pt;
  font-weight: 600;
  gap: 0.4em;
  letter-spacing: -0.005em;
}
.print-sheet .print-mark {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.print-sheet .print-title {
  color: #0f1115;
  font-size: 20pt;
  font-weight: 600;
  letter-spacing: -0.012em;
  line-height: 1.18;
  margin: 0.6rem 0 0;
}
.print-sheet .print-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 2.4em;
  margin: 0.8rem 0 0;
}
.print-sheet .print-meta > div {
  display: block;
}
.print-sheet .print-meta dt {
  color: #6b7079;
  font-size: 7.5pt;
  letter-spacing: 0.085em;
  text-transform: uppercase;
}
.print-sheet .print-meta dd {
  color: #14161a;
  font-feature-settings: 'tnum';
  font-size: 9.5pt;
  font-variant-numeric: tabular-nums;
  margin: 0.18em 0 0;
}
.print-sheet .print-contents {
  break-inside: avoid;
  margin: 0 0 1.9rem;
}
.print-sheet .print-contents-label {
  color: #6b7079;
  font-size: 7.5pt;
  letter-spacing: 0.085em;
  margin: 0 0 0.55em;
  text-transform: uppercase;
}
.print-sheet .print-contents-list {
  color: #14161a;
  display: block;
  font-size: 10pt;
  line-height: 1.5;
  list-style: decimal;
  margin: 0;
  padding-left: 1.5em;
}
.print-sheet .print-contents-list li {
  margin: 0 0 0.22em;
  padding-left: 0.15em;
}
.print-sheet .print-rule {
  background: none;
  border: 0;
  border-top: 1px solid #c9cdd4;
  height: 0;
  margin: 1.1rem 0 1.4rem;
}
.print-sheet .print-note {
  color: #5a5f68;
  font-size: 9.5pt;
  margin: 0;
}
.print-sheet .print-frame {
  break-inside: avoid;
  page-break-inside: avoid;
}
.print-sheet .print-frame,
.print-sheet .print-frame * {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.print-sheet .print-body > div,
.print-sheet .print-body > div > div {
  display: block;
}
.print-sheet .print-body > div {
  color: #14161a;
  font-size: 10.5pt;
  line-height: 1.6;
}
.print-sheet .print-body > div > div {
  margin: 0 0 0.95em;
}
.print-sheet .print-body > div > div > div {
  break-inside: avoid;
}
.print-sheet .print-body div {
  overflow: visible;
}
.print-sheet .print-body p,
.print-sheet .print-body ul,
.print-sheet .print-body ol,
.print-sheet .print-body pre,
.print-sheet .print-body blockquote,
.print-sheet .print-body table {
  margin: 0 0 0.7em;
}
.print-sheet .print-body h1,
.print-sheet .print-body h2,
.print-sheet .print-body h3,
.print-sheet .print-body h4,
.print-sheet .print-body h5,
.print-sheet .print-body h6 {
  break-after: avoid;
  color: #0f1115;
  font-weight: 600;
  line-height: 1.25;
}
.print-sheet .print-body h1 {
  font-size: 17.5pt;
  letter-spacing: -0.01em;
  margin: 1.6em 0 0.5em;
}
.print-sheet .print-body h2 {
  font-size: 15pt;
  margin: 1.45em 0 0.42em;
}
.print-sheet .print-body h3 {
  font-size: 12.5pt;
  margin: 1.3em 0 0.35em;
}
.print-sheet .print-body h4,
.print-sheet .print-body h5,
.print-sheet .print-body h6 {
  color: #4c515a;
  font-size: 9pt;
  letter-spacing: 0.07em;
  margin: 1.5em 0 0.5em;
  text-transform: uppercase;
}
.print-sheet .print-body > div > div:first-child > :first-child {
  margin-top: 0;
}
.print-sheet .print-body > div > div:last-child {
  margin-bottom: 0;
}
.print-sheet .print-body > div > div:last-child > :last-child {
  margin-bottom: 0;
}
.print-sheet .print-body ul,
.print-sheet .print-body ol {
  display: block;
  padding-left: 1.5em;
}
.print-sheet .print-body li {
  break-inside: avoid;
  line-height: 1.55;
  margin: 0 0 0.28em;
}
.print-sheet .print-body li > div {
  display: block;
}
.print-sheet .print-body code {
  background: none;
  border: 0;
  border-radius: 0;
  color: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.88em;
  padding: 0;
}
.print-sheet .print-body pre,
.print-sheet .print-body pre span {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.print-sheet .print-body pre {
  background: #ffffff;
  border: 1px solid #d5d8de;
  border-radius: 2px;
  break-inside: avoid;
  color: #14161a;
  font-size: 9pt;
  line-height: 1.5;
  overflow: visible;
  padding: 0.65em 0.8em;
  white-space: pre-wrap;
}
.print-sheet .print-body table {
  border-collapse: collapse;
  break-inside: avoid;
  font-size: 9.5pt;
  width: 100%;
}
.print-sheet .print-body th,
.print-sheet .print-body td {
  border-bottom: 1px solid #e2e5ea;
  font-feature-settings: 'tnum';
  font-variant-numeric: tabular-nums;
  padding: 0.38em 0.5em;
  vertical-align: top;
}
.print-sheet .print-body th {
  border-bottom: 1px solid #b9bec7;
  color: #4c515a;
  font-size: 8.5pt;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.print-sheet .print-body blockquote {
  border-left: 2px solid #d5d8de;
  color: #4c515a;
  display: block;
  font-size: 10pt;
  padding-left: 0.85em;
}
.print-sheet .print-body blockquote p {
  margin: 0 0 0.35em;
}
.print-sheet .print-body [role='separator'] {
  background: none;
  border-top: 1px solid #d5d8de;
  height: 0;
  margin: 1em 0;
}
.print-sheet .print-body img {
  break-inside: avoid;
  max-width: 100%;
}
@media print {
  html,
  body,
  body.bg-background {
    background: #ffffff;
  }
  html,
  body,
  #root {
    height: auto;
    overflow: visible;
  }
  .print-sheet {
    max-width: none;
    padding: 0;
  }
  .print-sheet .print-screens,
  .print-sheet .print-frames {
    display: block;
  }
  .print-sheet .print-frames {
    orphans: 1;
    widows: 1;
  }
  .print-sheet .print-frame {
    display: inline-flex;
    margin: 0 1rem 1.4rem 0;
    vertical-align: top;
  }
}
`;

export const PRINT_LANDSCAPE_CSS = `
@page {
  size: landscape;
}
@media screen {
  .print-sheet {
    max-width: 64rem;
  }
}
`;
