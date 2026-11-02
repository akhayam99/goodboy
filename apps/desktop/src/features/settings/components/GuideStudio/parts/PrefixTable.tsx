import { Kbd } from '@goodboy/ui';
import { PREFIXES } from '../../../../quick-actions/grammar';

const NOT_USED = 'not used';

export const PrefixTable = () => (
  <table className="w-full text-meta">
    <thead>
      <tr className="text-left text-faint-foreground">
        <th scope="col" className="w-16 font-normal">
          Prefix
        </th>
        <th scope="col" className="font-normal">
          In the palette
        </th>
        <th scope="col" className="font-normal">
          In the composer
        </th>
      </tr>
    </thead>
    <tbody>
      {PREFIXES.map((prefix) => (
        <tr key={prefix.symbol} className="text-foreground">
          <th scope="row" className="text-left font-normal">
            <Kbd look="cap">{prefix.symbol}</Kbd>
          </th>
          <td className={prefix.meaning.palette === null ? 'text-faint-foreground' : undefined}>
            {prefix.meaning.palette ?? NOT_USED}
          </td>
          <td className={prefix.meaning.composer === null ? 'text-faint-foreground' : undefined}>
            {prefix.meaning.composer ?? NOT_USED}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);
