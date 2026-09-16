export const PRINT_SHEET_CSS = `
.print-sheet {
  background: #ffffff;
  color: #14161a;
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 12px;
  line-height: 1.6;
  margin: 0 auto;
  max-width: 46rem;
  padding: 2.5rem 2rem;
}
.print-sheet .print-title {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.25;
}
.print-sheet .print-note {
  color: #5a5f68;
  font-size: 0.75rem;
}
.print-sheet pre,
.print-sheet table {
  break-inside: avoid;
}
.print-sheet h1,
.print-sheet h2,
.print-sheet h3 {
  break-after: avoid;
}
@page {
  margin: 16mm;
}
@media print {
  .print-sheet {
    padding: 0;
  }
}
`;
