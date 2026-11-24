import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { getApiErrorMessage } from "../../utils/apiError";

interface ResourceState<T> {
  scope: string;
  data: T | null;
  loading: boolean;
  error: string;
  saving: boolean;
}

/** Keep private administrative responses tied to the account that requested them. */
export function useAdminResource<T>(load: (signal: AbortSignal) => Promise<T>, loadError: string, resourceKey = "") {
  const { user } = useAuth();
  const scope = `${user?.id ?? "anonymous"}:${user?.role ?? ""}:${resourceKey}`;
  const allowed = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<ResourceState<T>>({
    scope, data: null, loading: true, error: "", saving: false,
  });
  const context = useRef<{ active: boolean; scope: string; saving: boolean } | null>(null);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const request = { active: true, scope, saving: false };
    context.current = request;
    setState({ scope, data: null, loading: allowed, error: "", saving: false });

    if (allowed) {
      void load(controller.signal).then((data) => {
        if (request.active) setState({ scope, data, loading: false, error: "", saving: false });
      }).catch((error: unknown) => {
        if (request.active) setState({
          scope, data: null, loading: false, saving: false,
          error: getApiErrorMessage(error, loadError),
        });
      });
    }
    return () => {
      request.active = false;
      controller.abort();
    };
  }, [allowed, load, loadError, revision, scope]);

  async function runAction(action: () => Promise<unknown>, actionError: string) {
    const request = context.current;
    if (!allowed || !request?.active || request.scope !== scope || request.saving) return false;
    request.saving = true;
    setState((current) => ({ ...current, saving: true, error: "" }));
    try {
      await action();
      if (!request.active) return false;
      reload();
      return true;
    } catch (error) {
      if (request.active) setState((current) => ({
        ...current, error: getApiErrorMessage(error, actionError),
      }));
      return false;
    } finally {
      request.saving = false;
      if (request.active) setState((current) => ({ ...current, saving: false }));
    }
  }

  const current = state.scope === scope && allowed
    ? state
    : { scope, data: null, loading: allowed, error: "", saving: false };
  return { ...current, reload, runAction };
}
