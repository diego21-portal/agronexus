import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<
  Props,
  State
> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(): State {
    return {
      hasError: true,
    };
  }

  componentDidCatch(
    error: Error,
    info: ErrorInfo
  ) {
    console.error(
      "AgroNexus frontend error:",
      error,
      info
    );

    /*
      En producción podemos enviar
      este error a Sentry u otro
      servicio de observabilidad.
    */
  }

  render() {
    if (
      this.state.hasError
    ) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
          <section className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-lg">
            <div className="text-5xl">
              ⚠️
            </div>

            <h1 className="mt-5 text-2xl font-bold">
              AgroNexus encontró un problema
            </h1>

            <p className="mt-3 text-gray-600">
              Ocurrió un error inesperado en esta pantalla.
              Tus datos no fueron modificados.
            </p>

            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() =>
                  window.location.reload()
                }
                className="rounded-lg bg-green-700 px-5 py-3 font-semibold text-white"
              >
                Recargar
              </button>

              <a
                href="/"
                className="rounded-lg border border-gray-300 px-5 py-3 font-semibold"
              >
                Ir al inicio
              </a>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}