import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../features/auth/AuthContext";
import { FormInput } from "../components/ui/FormInput";
import { registerSchema, type RegisterFormData } from "../schemas/authSchemas";
import { getApiErrorMessage } from "../utils/apiError";

export function RegisterPage() {
  const navigate =useNavigate();
  const { registerUser } = useAuth();

  const [ serverError, setServerError ] = useState("");

  const { register, handleSubmit,
    
    formState: {
      errors,
      isSubmitting,
    },
  } =
    useForm<RegisterFormData>({
      resolver:
        zodResolver(
          registerSchema
        ),

      defaultValues: {
        email: "",
        username: "",
        first_name: "",
        last_name: "",
        password: "",
        password_confirm: "",
      },
    });

  async function onSubmit(
    data:
      RegisterFormData
  ) {
    try {
      setServerError("");

      await registerUser(
        data
      );

      navigate(
        "/login",
        {
          replace: true,
        }
      );
    } catch (error) {
      setServerError(
        getApiErrorMessage(
          error,
          "No se pudo crear la cuenta."
        )
      );
    }
  }

  return (
    <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
        Nueva cuenta
      </p>

      <h1 className="mt-2 text-2xl font-bold">
        Registrarse en AgroNexus
      </h1>

      {serverError && (
        <div
          role="alert"
          className="mt-5 rounded-lg bg-red-50 p-4 text-red-700"
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
        className="mt-7 grid gap-4 md:grid-cols-2"
      >
        <div className="md:col-span-2">
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
        </div>

        <FormInput
          label="Usuario"
          autoComplete="username"
          error={
            errors.username
              ?.message
          }
          {...register(
            "username"
          )}
        />

        <FormInput
          label="Nombre"
          autoComplete="given-name"
          error={
            errors.first_name
              ?.message
          }
          {...register(
            "first_name"
          )}
        />

        <FormInput
          label="Apellido"
          autoComplete="family-name"
          error={
            errors.last_name
              ?.message
          }
          {...register(
            "last_name"
          )}
        />

        <div />

        <FormInput
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          error={
            errors.password
              ?.message
          }
          {...register(
            "password"
          )}
        />

        <FormInput
          label="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
          error={
            errors
              .password_confirm
              ?.message
          }
          {...register(
            "password_confirm"
          )}
        />

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={
              isSubmitting
            }
            className="w-full rounded-lg bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-50"
          >
            {isSubmitting
              ? "Creando cuenta..."
              : "Crear cuenta"}
          </button>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        ¿Ya tenés cuenta?{" "}

        <Link
          to="/login"
          className="font-semibold text-green-700"
        >
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}