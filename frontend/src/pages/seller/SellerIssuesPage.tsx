import {
  useEffect,
  useState,
} from "react";

import {
  getSellerComplaints,
  getSellerReturns,
} from "../../services/sellerService";

import type { Complaint } from "../../types/complaint";
import type { ReturnRequest } from "../../types/return";

import { StatusBadge } from "../../features/seller/StatusBadge";

export function SellerIssuesPage() {
  const [complaints, setComplaints] =
    useState<Complaint[]>([]);

  const [returns, setReturns] =
    useState<ReturnRequest[]>([]);

  const [tab, setTab] =
    useState<
      "complaints" | "returns"
    >("complaints");

  useEffect(() => {
    async function load() {
      const results =
        await Promise.allSettled([
          getSellerComplaints(),
          getSellerReturns(),
        ]);

      if (
        results[0].status ===
        "fulfilled"
      ) {
        setComplaints(
          results[0].value
        );
      }

      if (
        results[1].status ===
        "fulfilled"
      ) {
        setReturns(
          results[1].value
        );
      }
    }

    void load();
  }, []);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold">
        Reclamos y devoluciones
      </h2>

      <p className="mt-1 text-gray-600">
        Consultá incidencias relacionadas con tus ventas.
      </p>

      <div className="mt-6 flex gap-2 border-b">
        <button
          onClick={() =>
            setTab(
              "complaints"
            )
          }
          className={
            tab === "complaints"
              ? "border-b-2 border-green-700 px-4 py-3 font-semibold text-green-700"
              : "px-4 py-3 text-gray-500"
          }
        >
          Reclamos (
          {complaints.length})
        </button>

        <button
          onClick={() =>
            setTab("returns")
          }
          className={
            tab === "returns"
              ? "border-b-2 border-green-700 px-4 py-3 font-semibold text-green-700"
              : "px-4 py-3 text-gray-500"
          }
        >
          Devoluciones (
          {returns.length})
        </button>
      </div>

      {tab ===
      "complaints" ? (
        <div className="mt-5 space-y-4">
          {complaints.map(
            (complaint) => (
              <article
                key={complaint.id}
                className="rounded-xl border p-5"
              >
                <div className="flex justify-between gap-4">
                  <div>
                    <h3 className="font-bold">
                      {
                        complaint.title
                      }
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                      Orden{" "}
                      {complaint.order_number ||
                        complaint.order}
                    </p>
                  </div>

                  <StatusBadge
                    status={
                      complaint.status
                    }
                  />
                </div>

                <p className="mt-4 text-gray-700">
                  {
                    complaint.description
                  }
                </p>
              </article>
            )
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {returns.map(
            (item) => (
              <article
                key={item.id}
                className="rounded-xl border p-5"
              >
                <div className="flex justify-between gap-4">
                  <div>
                    <h3 className="font-bold">
                      {item.product_name ||
                        `Ítem ${item.order_item}`}
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                      {
                        item.order_number
                      }
                    </p>
                  </div>

                  <StatusBadge
                    status={
                      item.status
                    }
                  />
                </div>

                <p className="mt-4">
                  {
                    item.description
                  }
                </p>
              </article>
            )
          )}
        </div>
      )}
    </section>
  );
}