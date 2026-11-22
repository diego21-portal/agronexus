import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { getSellerDashboard } from "../../services/sellerService";
import { getApiErrorMessage } from "../../utils/apiError";
import { sellerDashboardSchema, type SellerDashboard } from "./contracts";

interface State {
  scope: string;
  data: SellerDashboard | null;
  loading: boolean;
  error: string;
}

export function useSellerDashboard() {
  const { user } = useAuth();
  const scope = `${user?.id ?? "anonymous"}:${user?.role ?? ""}`;
  const allowed = user?.role === "SELLER";
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<State>({ scope, data: null, loading: allowed, error: "" });
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setState({ scope, data: null, loading: allowed, error: "" });
    if (allowed) {
      void getSellerDashboard().then((response) => {
        const data = sellerDashboardSchema.parse(response);
        if (active) setState({ scope, data, loading: false, error: "" });
      }).catch((error: unknown) => {
        if (active) setState({ scope, data: null, loading: false,
          error: getApiErrorMessage(error, "No se pudo cargar el dashboard del vendedor."),
        });
      });
    }
    return () => { active = false; };
  }, [allowed, revision, scope]);

  return { ...(state.scope === scope && allowed ? state : { scope, data: null, loading: allowed, error: "" }), reload };
}
