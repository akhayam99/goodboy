import { ADE_GUIDE } from './adeGuide';

export const AdeCompare = () => (
  <section className="adeSection" aria-labelledby="ade-compare">
    <div className="prose adeCompare">
      <h2 id="ade-compare">{ADE_GUIDE.compare.heading}</h2>
      <p>{ADE_GUIDE.compare.intro}</p>
      <table aria-labelledby="ade-compare">
        <thead>
          <tr>
            <td />
            {ADE_GUIDE.compare.columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ADE_GUIDE.compare.rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.ide}</td>
              <td>{row.terminal}</td>
              <td>{row.ade}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);
