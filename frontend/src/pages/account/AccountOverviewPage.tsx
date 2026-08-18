import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../features/auth/AuthContext";
import { getMyComplaints } from "../../services/complaintService";
import { getFavorites } from "../../services/favoriteService";
import { getOrders } from "../../services/orderService";
import { getMyReturns } from "../../services/returnService";
import type { Order } from "../../types/order";
import { formatCurrency } from "../../utils/currency";

interface AccountStats {
  orders: number;
  favorites: number;
  complaints: number;
  returns: number;
}

export function AccountOverviewPage() {
  const { user } = useAuth();

  const [stats, setStats] = useState<AccountStats>({
    orders: 0,
    favorites: 0,
    complaints: 0,
    returns: 0,
  });

  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);

        const results = await Promise.allSettled([
          getOrders(),
          getFavorites(),
          getMyComplaints(),
          getMyReturns(),
        ]);

        const orders =
          results[0].status === "fulfilled"
            ? results[0].value
            : [];

        const favorites =
          results[1].status === "fulfilled"
            ? results[1].value
            : [];

        const complaints =
          results[2].status === "fulfilled"
            ? results[2].value
            : [];

        const returns =
          results[3].status === "fulfilled"
            ? results[3].value
            : [];

        setStats({
          orders: orders.length,
          favorites: favorites.length,
          complaints: complaints.length,
          returns: returns.length,
        });

        setRecentOrders(orders.slice(0, 5));
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">Bienvenido</p>

        <h2 className="mt-1 text-2xl font-bold">
          {user?.first_name || user?.username}
        </h2>

        <p className="mt-2 text-gray-600">
          Desde acá podés administrar toda tu actividad dentro de AgroNexus.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Pedidos"
          value={stats.orders}
          link="/account/orders"
        />

        <StatCard
          title="Favoritos"
          value={stats.favorites}
          link="/account/favorites"
        />

        <StatCard
          title="Reclamos"
          value={stats.complaints}
          link="/account/complaints"
        />

        <StatCard
          title="Devoluciones"
          value={stats.returns}
          link="/account/returns"
        />
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">
            Pedidos recientes
          </h2>

          <Link
            to="/account/orders"
            className="text-sm font-medium text-green-700"
          >
            Ver todos
          </Link>
        </div>

        {loading ? (
          <p className="mt-5 text-gray-600">
            Cargando...
          </p>
        ) : recentOrders.length === 0 ? (
          <div className="mt-5 rounded-xl bg-gray-50 p-6 text-center">
            <p className="text-gray-600">
              Todavía no realizaste compras.
            </p>

            <Link
              to="/products"
              className="mt-3 inline-block font-medium text-green-700"
            >
              Explorar catálogo
            </Link>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                to={`/account/orders/${order.id}`}
                className="flex flex-col justify-between gap-3 rounded-xl border border-gray-200 p-4 hover:border-green-400 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-bold">
                    {order.order_number}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleDateString(
                      "es-AR"
                    )}
                  </p>
                </div>

                <div className="sm:text-right">
                  <p className="font-bold text-green-700">
                    {formatCurrency(order.total)}
                  </p>

                  <p className="text-sm text-gray-500">
                    {order.status}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  link,
}: {
  title: string;
  value: number;
  link: string;
}) {
  return (
    <Link
      to={link}
      className="rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
    >
      <p className="text-sm text-gray-500">{title}</p>

      <p className="mt-2 text-3xl font-bold">
        {value}
      </p>

      <p className="mt-3 text-sm font-medium text-green-700">
        Ver detalle →
      </p>
    </Link>
  );
}