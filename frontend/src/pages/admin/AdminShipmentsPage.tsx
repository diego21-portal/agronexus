import {
  useEffect,
  useState,
} from "react";

import { getAdminShipments } from "../../services/adminService";

import type {
  AdminShipment,
} from "../../types/admin";

import { StatusBadge } from "../../features/seller/StatusBadge";

export function AdminShipmentsPage() {
  const [shipments, setShipments] =
    useState<AdminShipment[]>([]);

  useEffect(() => {
    getAdminShipments()
      .then(setShipments)
      .catch(() => {
        setShipments([]);
      });
  }, []);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold">
        Envíos
      </h2>

      <p className="mt-1 text-gray-600">
        Estado logístico global.
      </p>

      <div className="mt-6 space-y-3">
        {shipments.map(
          (shipment) => (
            <article
              key={shipment.id}
              className="flex flex-col justify-between gap-4 rounded-xl border p-5 md:flex-row md:items-center"
            >
              <div>
                <p className="font-bold">
                  Orden{" "}
                  {shipment.order_number ||
                    shipment.order}
                </p>

                <p className="mt-1 font-mono text-xs text-gray-500">
                  {shipment.tracking_code ||
                    "Sin tracking"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  {
                    shipment.carrier ||
                    "Sin transportista"
                  }
                </p>
              </div>

              <StatusBadge
                status={
                  shipment.status
                }
              />
            </article>
          )
        )}
      </div>
    </section>
  );
}