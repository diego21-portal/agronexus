import { useEffect, useState } from "react";
import { Link } from "react-router";
import { getMyQuestions } from "../../services/accountActivityService";
import type { ProductQuestion } from "../../types/productSocial";
import { getApiErrorMessage } from "../../utils/apiError";

export function MyQuestionsPage() {
  const [questions, setQuestions] =
    useState<ProductQuestion[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function load() {
      try {
        setQuestions(
          await getMyQuestions()
        );
      } catch (requestError) {
        setError(
          getApiErrorMessage(
            requestError,
            "No se pudieron cargar tus preguntas."
          )
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold">
        Mis preguntas
      </h2>

      {error && (
        <div className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-6">Cargando...</p>
      ) : questions.length === 0 ? (
        <p className="mt-6 text-gray-600">
          Todavía no realizaste preguntas.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {questions.map((question) => (
            <article
              key={question.id}
              className="rounded-xl border p-5"
            >
              {question.product_slug && (
                <Link
                  to={`/products/${question.product_slug}`}
                  className="text-sm font-medium text-green-700"
                >
                  {question.product_name ||
                    "Ver producto"}
                </Link>
              )}

              <p className="mt-3 font-bold">
                {question.question}
              </p>

              {question.answer ? (
                <div className="mt-4 rounded-lg bg-green-50 p-4">
                  <p className="text-sm font-bold text-green-800">
                    Respuesta
                  </p>

                  <p className="mt-1 text-green-900">
                    {question.answer}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-yellow-700">
                  Esperando respuesta del vendedor.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}