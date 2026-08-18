import {
  useEffect,
  useState,
} from "react";

import { getAdminPayments } from "../../services/adminService";

import type {
  AdminPayment,
} from "../../types/admin";

import { StatusBadge } from "../../features/seller/StatusBadge";

import { formatCurrency } from "../../utils/currency";

export function AdminPaymentsPage() {
  const [payments, setPayments] =
    useState<AdminPayment[]>([]);

  useEffect(() => {
    getAdminPayments()
      .then(setPayments)
      .catch(() => {
        setPayments([]);
      });
  }, []);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold">
        Pagos
      </h2>

      <p className="mt-1 text-gray-600">
        Registro financiero de operaciones.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[750px] text-left text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="pb-3">
                Orden
              </th>

              <th className="pb-3">
                Método
              </th>

              <th className="pb-3">
                Estado
              </th>

              <th className="pb-3">
                Transacción
              </th>

              <th className="pb-3 text-right">
                Importe
              </th>
            </tr>
          </thead>

          <tbody>
            {payments.map(
              (payment) => (
                <tr
                  key={payment.id}
                  className="border-b"
                >
                  <td className="py-4 font-semibold">
                    {payment.order_number ||
                      payment.order}
                  </td>

                  <td className="py-4">
                    {
                      payment.payment_method
                    }
                  </td>

                  <td className="py-4">
                    <StatusBadge
                      status={
                        payment.status
                      }
                    />
                  </td>

                  <td className="py-4 font-mono text-xs">
                    {payment.transaction_code ||
                      "—"}
                  </td>

                  <td className="py-4 text-right font-bold">
                    {formatCurrency(
                      payment.amount
                    )}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}