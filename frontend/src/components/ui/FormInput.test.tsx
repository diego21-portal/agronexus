import {
  render,
  screen,
} from "@testing-library/react";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  FormInput,
} from "./FormInput";

describe(
  "FormInput",
  () => {
    it(
      "asocia correctamente label e input",
      () => {
        render(
          <FormInput
            label="Email"
            type="email"
          />
        );

        expect(
          screen.getByLabelText(
            "Email"
          )
        ).toBeInTheDocument();
      }
    );

    it(
      "muestra error accesible",
      () => {
        render(
          <FormInput
            label="Email"
            error="Email inválido"
          />
        );

        const input =
          screen.getByLabelText(
            "Email"
          );

        expect(
          input
        ).toHaveAttribute(
          "aria-invalid",
          "true"
        );

        expect(
          screen.getByRole(
            "alert"
          )
        ).toHaveTextContent(
          "Email inválido"
        );
      }
    );
  }
);