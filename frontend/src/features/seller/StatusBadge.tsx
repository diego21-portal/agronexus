interface StatusBadgeProps {
  status: string;
}

const labels: Record<string, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  OUT_OF_STOCK: "Sin stock",
  ARCHIVED: "Archivado",

  PENDING: "Pendiente",
  PAID: "Pagado",
  PREPARING: "Preparando",
  SHIPPED: "Despachado",
  IN_TRANSIT: "En tránsito",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",

  ANSWERED: "Respondida",
  OPEN: "Abierto",
  IN_REVIEW: "En revisión",
  RESOLVED: "Resuelto",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
};

export function StatusBadge({
  status,
}: StatusBadgeProps) {
  return (
    <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
      {labels[status] || status}
    </span>
  );
}