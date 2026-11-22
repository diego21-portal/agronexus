import { Link } from "react-router";
import { AdminStatCard } from "../features/admin/AdminStatCard";
import { AdminResourceState } from "../features/admin/AdminResourceState";
import { useAdminResource } from "../features/admin/useAdminResource";
import { StatusBadge } from "../features/seller/StatusBadge";
import { adminDashboardSchema } from "../features/dashboards/contracts";
import { MonthlySales } from "../features/dashboards/MonthlySales";
import { getAdminDashboard } from "../services/adminService";
import { formatCurrency } from "../utils/currency";

async function loadDashboard() {
  return adminDashboardSchema.parse(await getAdminDashboard());
}

export function AdminDashboardPage() {
  const { data: dashboard, loading, error, reload } = useAdminResource(
    loadDashboard, "No se pudo cargar el dashboard administrativo.",
  );

  if (loading || error || !dashboard) return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <AdminResourceState loading={loading} error={error} empty={!loading && !error}
        loadingText="Cargando administración..." emptyText="La información no está disponible." onRetry={reload} />
    </section>
  );

  return <div className="space-y-6">
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <AdminStatCard title="Usuarios" value={dashboard.users.total_users} />
      <AdminStatCard title="Vendedores" value={dashboard.sellers.total_sellers} />
      <AdminStatCard title="Productos" value={dashboard.products.total_products} />
      <AdminStatCard title="Órdenes" value={dashboard.orders.total_orders} />
    </section>

    <section aria-label="Ingresos netos simulados" className="rounded-2xl bg-gray-900 p-6 text-white shadow-sm">
      <h2 className="text-sm text-gray-300">Ingresos netos simulados</h2>
      <p className="mt-2 text-4xl font-bold">{formatCurrency(dashboard.sales.total_revenue)}</p>
      <p className="mt-2 text-sm text-gray-300">Importe aprobado menos reembolsos registrados. No representa cobros reales.</p>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div><dt className="text-sm text-gray-300">Importe bruto aprobado</dt><dd className="mt-1 font-semibold">{formatCurrency(dashboard.sales.gross_revenue)}</dd></div>
        <div><dt className="text-sm text-gray-300">Reembolsos registrados</dt><dd className="mt-1 font-semibold">{formatCurrency(dashboard.sales.refunded_amount)}</dd></div>
      </dl>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <AlertCard title="Stock bajo" value={dashboard.products.low_stock_products} link="/admin/products" />
      <AlertCard title="Activos sin existencias" value={dashboard.stock.out_of_stock_count} link="/admin/products" />
      <AlertCard title="Reclamos abiertos" value={dashboard.complaints.open_complaints} link="/admin/complaints" />
      <AlertCard title="Devoluciones solicitadas" value={dashboard.returns.requested_returns} link="/admin/returns" />
    </section>

    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Órdenes recientes</h2>
        <Link to="/admin/orders" className="text-sm font-semibold text-green-700">Ver todas</Link>
      </div>
      {dashboard.recent_orders.length === 0 ? <p className="mt-6 text-gray-500">No hay órdenes recientes.</p> :
        <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr className="border-b text-gray-500">
            <th className="pb-3">Orden</th><th className="pb-3">Estado</th><th className="pb-3">Fecha</th><th className="pb-3 text-right">Total original</th>
          </tr></thead>
          <tbody>{dashboard.recent_orders.map((order) => <tr key={order.id} className="border-b last:border-0">
            <td className="py-4"><Link to={`/admin/orders/${order.id}`} className="font-semibold hover:text-green-700">{order.order_number}</Link></td>
            <td className="py-4"><StatusBadge status={order.status} /></td>
            <td className="py-4">{new Date(order.created_at).toLocaleDateString("es-AR")}</td>
            <td className="py-4 text-right font-bold">{formatCurrency(order.total)}</td>
          </tr>)}</tbody>
        </table></div>}
    </section>

    <section className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">Productos más vendidos</h2>
        <p className="mt-1 text-sm text-gray-500">Unidades vendidas e ingresos netos simulados.</p>
        {dashboard.top_products.length === 0 ? <p className="mt-5 text-gray-500">Todavía no hay productos vendidos.</p> :
          <ol className="mt-5 space-y-3">{dashboard.top_products.map((product, index) =>
            <li key={`${product.product_id ?? "historical"}:${product.sku}:${index}`} className="flex items-center justify-between gap-4 rounded-xl border p-4">
              <div><p className="font-semibold">#{index + 1} {product.product_name}</p>
                <p className="mt-1 text-sm text-gray-500">{product.seller ?? "Vendedor no disponible"} · {product.units_sold} vendidos</p></div>
              <p className="font-bold">{formatCurrency(product.revenue)}</p>
            </li>)}</ol>}
      </section>
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">Mejores vendedores</h2>
        <p className="mt-1 text-sm text-gray-500">Ordenados por ingresos netos simulados.</p>
        {dashboard.top_sellers.length === 0 ? <p className="mt-5 text-gray-500">Todavía no hay vendedores con ventas.</p> :
          <ol className="mt-5 space-y-3">{dashboard.top_sellers.map((seller, index) =>
            <li key={`${seller.seller_id ?? "historical"}:${index}`} className="flex items-center justify-between gap-4 rounded-xl border p-4">
              <div><p className="font-semibold">#{index + 1} {seller.seller ?? "Vendedor no disponible"}</p>
                <p className="mt-1 text-sm text-gray-500">{seller.orders_count} pedidos · {seller.units_sold} unidades</p></div>
              <p className="font-bold text-green-700">{formatCurrency(seller.revenue)}</p>
            </li>)}</ol>}
      </section>
    </section>
    <MonthlySales rows={dashboard.monthly_sales} />
  </div>;
}

function AlertCard({ title, value, link }: { title: string; value: number; link: string }) {
  return <Link aria-label={`${title}: ${value}`} to={link} className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
    <p className="text-sm font-medium text-yellow-800">{title}</p>
    <p className="mt-2 text-3xl font-bold text-yellow-900">{value}</p>
    <p className="mt-2 text-sm text-yellow-700">Revisar →</p>
  </Link>;
}
