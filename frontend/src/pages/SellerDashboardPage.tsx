import { Link } from "react-router";
import { SellerStatCard } from "../features/seller/SellerStatCard";
import { StatusBadge } from "../features/seller/StatusBadge";
import { AdminResourceState } from "../features/admin/AdminResourceState";
import { MonthlySales } from "../features/dashboards/MonthlySales";
import { useSellerDashboard } from "../features/dashboards/useSellerDashboard";
import { formatCurrency } from "../utils/currency";

export function SellerDashboardPage() {
  const { data: dashboard, loading, error, reload } = useSellerDashboard();

  if (loading || error || !dashboard) return <section className="rounded-2xl bg-white p-6 shadow-sm">
    <AdminResourceState loading={loading} error={error} empty={!loading && !error}
      loadingText="Cargando dashboard..." emptyText="La información no está disponible." onRetry={reload} />
  </section>;

  return <div className="space-y-6">
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SellerStatCard title="Productos" value={dashboard.products.total_products} subtitle={`${dashboard.products.published_products} publicados`} />
      <SellerStatCard title="Pedidos" value={dashboard.orders.total_orders} />
      <SellerStatCard title="Ingresos netos simulados" value={formatCurrency(dashboard.sales.total_revenue)} subtitle="Ventas de tus productos menos reembolsos registrados" />
      <SellerStatCard title="Preguntas pendientes" value={dashboard.questions.pending_questions} />
    </section>
    <section className="grid gap-4 sm:grid-cols-2">
      <SellerStatCard title="Importe bruto vendido" value={formatCurrency(dashboard.sales.gross_revenue)} subtitle="Importe original de tus productos en las ventas del resumen" />
      <SellerStatCard title="Reembolsos registrados" value={formatCurrency(dashboard.sales.refunded_amount)} subtitle="Importes descontados del resumen de tus ventas" />
    </section>
    <section className="grid gap-4 sm:grid-cols-2">
      <Link to="/seller/stock" className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 transition hover:shadow-sm">
        <p className="text-sm font-medium text-yellow-700">Stock bajo</p>
        <p className="mt-2 text-3xl font-bold text-yellow-900">{dashboard.products.low_stock_products}</p>
        <p className="mt-2 text-sm text-yellow-700">Revisar inventario →</p>
      </Link>
      <Link to="/seller/stock" className="rounded-2xl border border-red-200 bg-red-50 p-5 transition hover:shadow-sm">
        <p className="text-sm font-medium text-red-700">Activos sin existencias</p>
        <p className="mt-2 text-3xl font-bold text-red-900">{dashboard.stock.out_of_stock_count}</p>
        <p className="mt-2 text-sm text-red-700">Gestionar productos →</p>
      </Link>
    </section>

    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Pedidos recientes</h2>
        <Link to="/seller/orders" className="text-sm font-semibold text-green-700">Ver todos</Link>
      </div>
      {dashboard.recent_orders.length === 0 ? <p className="mt-6 rounded-xl bg-gray-50 p-5 text-gray-500">No hay pedidos recientes.</p> :
        <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr className="border-b text-gray-500">
            <th className="pb-3">Orden</th><th className="pb-3">Fecha</th><th className="pb-3">Estado</th><th className="pb-3 text-right">Subtotal vendido</th>
          </tr></thead>
          <tbody>{dashboard.recent_orders.map((order) => <tr key={order.id} className="border-b last:border-0">
            <td className="py-4"><Link to={`/seller/orders/${order.id}`} className="font-semibold hover:text-green-700">{order.order_number}</Link></td>
            <td className="py-4">{new Date(order.created_at).toLocaleDateString("es-AR")}</td>
            <td className="py-4"><StatusBadge status={order.status} /></td>
            <td className="py-4 text-right font-semibold">{formatCurrency(order.seller_subtotal)}</td>
          </tr>)}</tbody>
        </table></div>}
    </section>

    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">Productos más vendidos</h2>
      <p className="mt-1 text-sm text-gray-500">Unidades vendidas e ingresos netos simulados de tus productos.</p>
      {dashboard.top_products.length === 0 ? <p className="mt-5 text-gray-500">Todavía no hay datos suficientes.</p> :
        <ol className="mt-5 space-y-3">{dashboard.top_products.map((product, index) =>
          <li key={`${product.product_id ?? "historical"}:${product.sku}:${index}`} className="flex items-center justify-between gap-4 rounded-xl border p-4">
            <div><p className="font-semibold">#{index + 1} {product.product_name}</p>
              <p className="mt-1 text-sm text-gray-500">{product.units_sold} unidades</p></div>
            <p className="font-bold text-green-700">{formatCurrency(product.revenue)}</p>
          </li>)}</ol>}
    </section>
    <MonthlySales rows={dashboard.monthly_sales} showUnits />
  </div>;
}
