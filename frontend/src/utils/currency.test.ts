import {
  describe,
  expect,
  it,
} from "vitest";

import {
  formatCurrency,
} from "./currency";

describe(
  "formatCurrency",
  () => {
    it(
      "formatea moneda argentina",
      () => {
        const result =
          formatCurrency(
            123456.78
          );

        expect(
          result
        ).toMatch(
          /123\.456,78/
        );
      }
    );

    it(
      "acepta números como string",
      () => {
        const result =
          formatCurrency(
            "1500"
          );

        expect(
          result
        ).toContain(
          "1.500"
        );
      }
    );
  }
);