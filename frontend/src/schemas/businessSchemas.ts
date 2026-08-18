import { z } from "zod";

export const sellerProductSchema =
  z
    .object({
      category:
        z.number().int().positive(
          "Seleccioná una categoría."
        ),

      brand:
        z
          .number()
          .int()
          .positive()
          .nullable(),

      region:
        z.number().int().positive(
          "Seleccioná una región."
        ),

      name:
        z
          .string()
          .trim()
          .min(
            3,
            "El nombre es demasiado corto."
          ),

      sku:
        z
          .string()
          .trim()
          .min(
            2,
            "Ingresá un SKU."
          ),

      short_description:
        z
          .string()
          .trim()
          .min(
            10,
            "La descripción corta debe ser más detallada."
          ),

      description:
        z
          .string()
          .trim()
          .min(
            20,
            "La descripción debe tener al menos 20 caracteres."
          ),

      technical_description:
        z.string(),

      price:
        z
          .string()
          .refine(
            (value) =>
              Number(value) >
              0,
            "El precio debe ser mayor que cero."
          ),

      discount_price:
        z
          .string()
          .nullable()
          .refine(
            (value) =>
              value === null ||
              value === "" ||
              Number(value) >=
                0,
            "Precio de descuento inválido."
          ),

      unit:
        z.string().min(1),

      stock:
        z.number().int().min(
          0,
          "El stock no puede ser negativo."
        ),

      minimum_stock:
        z.number().int().min(
          0,
          "El stock mínimo no puede ser negativo."
        ),

      condition:
        z.string(),

      status:
        z.string(),

      warranty:
        z.string(),

      shipping_available:
        z.boolean(),

      is_active:
        z.boolean(),

      is_featured:
        z.boolean(),
    })
    .refine(
      (data) =>
        !data.discount_price ||
        Number(
          data.discount_price
        ) <
          Number(
            data.price
          ),
      {
        message:
          "El precio con descuento debe ser menor al precio normal.",

        path: [
          "discount_price",
        ],
      }
    );

export const addressSchema =
  z.object({
    region:
      z.number().int().positive(
        "Seleccioná una región."
      ),

    street:
      z
        .string()
        .trim()
        .min(
          2,
          "Ingresá la calle."
        ),

    number:
      z
        .string()
        .trim()
        .min(
          1,
          "Ingresá el número."
        ),

    city:
      z
        .string()
        .trim()
        .min(
          2,
          "Ingresá la ciudad."
        ),

    province:
      z
        .string()
        .trim()
        .min(2),

    postal_code:
      z
        .string()
        .trim()
        .min(
          3,
          "Código postal inválido."
        ),

    reference:
      z.string().optional(),

    is_default:
      z.boolean(),
  });

export const complaintSchema =
  z.object({
    complaint_type:
      z.string().min(1),

    title:
      z
        .string()
        .trim()
        .min(
          5,
          "El título es demasiado corto."
        ),

    description:
      z
        .string()
        .trim()
        .min(
          20,
          "Explicá con mayor detalle qué ocurrió."
        ),
  });

export const returnSchema =
  z.object({
    reason:
      z.string().min(1),

    description:
      z
        .string()
        .trim()
        .min(
          20,
          "Explicá con mayor detalle el motivo."
        ),

    quantity:
      z.number().int().positive(
        "La cantidad debe ser mayor que cero."
      ),
  });