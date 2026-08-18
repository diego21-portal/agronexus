import {
  render,
  screen,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import {
  MemoryRouter,
  useLocation,
} from "react-router";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  GlobalSearchBar,
} from "./GlobalSearchBar";

function LocationProbe() {
  const location =
    useLocation();

  return (
    <output
      data-testid="location"
    >
      {location.pathname}
      {location.search}
    </output>
  );
}

describe(
  "GlobalSearchBar",
  () => {
    it(
      "navega al catálogo con search param",
      async () => {
        const user =
          userEvent.setup();

        render(
          <MemoryRouter
            initialEntries={[
              "/",
            ]}
          >
            <GlobalSearchBar />

            <LocationProbe />
          </MemoryRouter>
        );

        const input =
          screen.getByRole(
            "textbox",
            {
              name:
                /buscar productos/i,
            }
          );

        await user.type(
          input,
          "bomba"
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Buscar",
            }
          )
        );

        expect(
          screen.getByTestId(
            "location"
          )
        ).toHaveTextContent(
          "/products?search=bomba"
        );
      }
    );
  }
);