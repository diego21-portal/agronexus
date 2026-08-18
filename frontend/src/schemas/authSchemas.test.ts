import {
  describe,
  expect,
  it,
} from "vitest";

import {
  loginSchema,
  registerSchema,
} from "./authSchemas";

describe(
  "authSchemas",
  () => {
    it(
      "acepta un login válido",
      () => {
        const result =
          loginSchema.safeParse(
            {
              email:
                "cliente@agronexus.com",

              password:
                "Demo123456",
            }
          );

        expect(
          result.success
        ).toBe(true);
      }
    );

    it(
      "rechaza email inválido",
      () => {
        const result =
          loginSchema.safeParse(
            {
              email:
                "email-invalido",

              password:
                "Demo123456",
            }
          );

        expect(
          result.success
        ).toBe(false);
      }
    );

    it(
      "rechaza contraseñas diferentes",
      () => {
        const result =
          registerSchema.safeParse(
            {
              email:
                "nuevo@test.com",

              username:
                "nuevo",

              first_name:
                "Juan",

              last_name:
                "Perez",

              password:
                "Password123",

              password_confirm:
                "Password456",
            }
          );

        expect(
          result.success
        ).toBe(false);
      }
    );

    it(
      "acepta registro válido",
      () => {
        const result =
          registerSchema.safeParse(
            {
              email:
                "nuevo@test.com",

              username:
                "nuevo",

              first_name:
                "Juan",

              last_name:
                "Perez",

              password:
                "Password123",

              password_confirm:
                "Password123",
            }
          );

        expect(
          result.success
        ).toBe(true);
      }
    );
  }
);