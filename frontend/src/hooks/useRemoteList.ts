import { useEffect, useState } from "react";

export type RemoteListState<T> =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; items: T[] };

export function useRemoteList<T>(load: (signal: AbortSignal) => Promise<T[]>) {
  const [state, setState] = useState<RemoteListState<T>>({ status: "loading" });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).then(
      (items) => {
        if (!controller.signal.aborted) setState({ status: "loaded", items });
      },
      () => {
        if (!controller.signal.aborted) setState({ status: "error" });
      },
    );
    return () => controller.abort();
  }, [load, revision]);

  function retry() {
    setState({ status: "loading" });
    setRevision((value) => value + 1);
  }

  return { state, retry };
}
