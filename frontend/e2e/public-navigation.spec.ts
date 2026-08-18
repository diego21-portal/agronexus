import {
  test,
  expect,
} from "@playwright/test";

test(
  "Home de AgroNexus carga correctamente",
  async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole(
        "heading",
        {
          name:
            /Todo lo que el campo necesita/i,
        }
      )
    ).toBeVisible();

    await expect(
      page.getByText(
        /AgroNexus/i
      ).first()
    ).toBeVisible();
  }
);

test(
  "permite navegar al catálogo",
  async ({ page }) => {
    await page.goto("/");

    await page
      .getByRole(
        "link",
        {
          name:
            "Productos",
        }
      )
      .first()
      .click();

    await expect(
      page
    ).toHaveURL(
      /\/products/
    );

    await expect(
      page.getByRole(
        "heading",
        {
          name:
            "Productos",
        }
      )
    ).toBeVisible();
  }
);

test(
  "muestra página 404",
  async ({ page }) => {
    await page.goto(
      "/ruta-que-no-existe"
    );

    await expect(
      page.getByRole(
        "heading",
        {
          name:
            /Página no encontrada/i,
        }
      )
    ).toBeVisible();

    await expect(
      page.getByText(
        "404"
      )
    ).toBeVisible();
  }
);

test(
  "menú móvil funciona",
  async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chrome",
      "Este test corresponde únicamente al layout móvil."
    );

    await page.goto("/");

    const menu =
      page.getByRole(
        "button",
        {
          name: "Abrir menú",
        }
      );

    await expect(
      menu
    ).toBeVisible();

    await menu.click();

    await expect(
      page
        .getByRole(
          "link",
          {
            name: "Productos",
          }
        )
        .last()
    ).toBeVisible();
  }
);