import { formatCurrency } from "../../utils/currency";

export function MonthlySales({ rows, showUnits = false }: {
  showUnits?: boolean;
  rows: { month: string | null; revenue: number; orders_count: number; units_sold?: number }[];
}) {
  return <section className="rounded-2xl bg-white p-6 shadow-sm">
    <h2 className="text-xl font-bold">Ventas mensuales</h2>
    <p className="mt-1 text-sm text-gray-500">Ingresos netos simulados, descontando reembolsos.</p>
    {rows.length === 0 ? <p className="mt-5 text-gray-500">Todavía no hay ventas mensuales registradas.</p> :
      <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm">
        <thead><tr className="border-b text-gray-500">
          <th className="pb-3">Mes</th><th className="pb-3">Pedidos</th>
          {showUnits && <th className="pb-3">Unidades</th>}
          <th className="pb-3 text-right">Ingresos netos</th>
        </tr></thead>
        <tbody>{rows.map((row, index) => <tr key={row.month ?? `unknown-${index}`} className="border-b last:border-0">
          <td className="py-3">{row.month ?? "Mes no registrado"}</td>
          <td className="py-3">{row.orders_count}</td>
          {showUnits && <td className="py-3">{row.units_sold ?? "No disponible"}</td>}
          <td className="py-3 text-right font-semibold">{formatCurrency(row.revenue)}</td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}
