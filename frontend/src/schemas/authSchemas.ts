import { z } from "zod";

export const loginSchema =
  z.object({
    email: z
      .string()
      .trim()
      .min(
        1,
        "El email es obligatorio."
      )
      .email(
        "Ingresá un email válido."
      ),

    password: z
      .string()
      .min(
        1,
        "La contraseña es obligatoria."
      ),
  });

export type LoginFormData =
  z.infer<
    typeof loginSchema
  >;

export const registerSchema =
  z
    .object({
      email: z
        .string()
        .trim()
        .min(
          1,
          "El email es obligatorio."
        )
        .email(
          "Ingresá un email válido."
        ),

      username: z
        .string()
        .trim()
        .min(
          3,
          "El usuario debe tener al menos 3 caracteres."
        )
        .max(
          50,
          "El usuario es demasiado largo."
        ),

      first_name: z
        .string()
        .trim()
        .min(
          2,
          "Ingresá tu nombre."
        ),

      last_name: z
        .string()
        .trim()
        .min(
          2,
          "Ingresá tu apellido."
        ),

      password: z
        .string()
        .min(
          8,
          "La contraseña debe tener al menos 8 caracteres."
        )
        .regex(
          /[A-Z]/,
          "Debe contener al menos una mayúscula."
        )
        .regex(
          /[a-z]/,
          "Debe contener al menos una minúscula."
        )
        .regex(
          /\d/,
          "Debe contener al menos un número."
        ),

      password_confirm:
        z.string(),
    })
    .refine(
      (data) =>
        data.password ===
        data.password_confirm,
      {
        message:
          "Las contraseñas no coinciden.",

        path: [
          "password_confirm",
        ],
      }
    );

export type RegisterFormData =
  z.infer<
    typeof registerSchema
  >;