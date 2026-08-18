import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../features/auth/AuthContext";
import { FormInput } from "../components/ui/FormInput";
import { loginSchema, type LoginFormData } from "../schemas/authSchemas";
import { getApiErrorMessage } from "../utils/apiError";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginUser } = useAuth();
  const [ serverError, setServerError ] = useState("");
  const {
    register,
    handleSubmit,

    formState: {
      errors,
      isSubmitting,
    },
  } =
    useForm<LoginFormData>({
      resolver:
        zodResolver(
          loginSchema
        ),

      defaultValues: {
        email:
          "cliente@agronexus.com",

        password:
          "Demo123456",
      },
    });

  const state =
    location.state as
      | {
          from?: {
            pathname?: string;
          };
        }
      | null;

  const from =
    state?.from?.pathname ||
    "/products";

  async function onSubmit(
    data: LoginFormData
  ) {
    try {
      setServerError("");

      await loginUser(data);

      navigate(
        from,
        {
          replace: true,
        }
      );
    } catch (error) {
      setServerError(
        getApiErrorMessage(
          error,
          "No se pudo iniciar sesión. Revisá tus datos."
        )
      );
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
        AgroNexus
      </p>

      <h1 className="mt-2 text-2xl font-bold">
        Iniciar sesión
      </h1>

      <p className="mt-2 text-sm text-gray-600">
        Ingresá a tu cuenta para comprar y gestionar tu actividad.
      </p>

      {serverError && (
        <div
          role="alert"
          className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {serverError}
        </div>
      )}

      <form
        onSubmit={
          handleSubmit(
            onSubmit
          )
        }
        noValidate
        className="mt-6 space-y-4"
      >
        <FormInput
          label="Email"
          type="email"
          autoComplete="email"
          error={
            errors.email
              ?.message
          }
          {...register(
            "email"
          )}
        />

        <FormInput
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          error={
            errors.password
              ?.message
          }
          {...register(
            "password"
          )}
        />

        <button
          type="submit"
          disabled={
            isSubmitting
          }
          className="w-full rounded-lg bg-green-700 px-4 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-50"
        >
          {isSubmitting
            ? "Ingresando..."
            : "Ingresar"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        ¿No tenés cuenta?{" "}

        <Link
          to="/register"
          className="font-semibold text-green-700"
        >
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}