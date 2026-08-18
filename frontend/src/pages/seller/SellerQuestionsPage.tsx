import { useEffect, useState } from "react";

import {
  answerSellerQuestion,
  getSellerQuestions,
} from "../../services/sellerService";

import type { SellerQuestion } from "../../types/seller";

import { getApiErrorMessage } from "../../utils/apiError";

export function SellerQuestionsPage() {
  const [questions, setQuestions] = useState<SellerQuestion[]>([]);

  const [answers, setAnswers] = useState<Record<number, string>>({});

  const [loading, setLoading] = useState(true);

  const [sendingId, setSendingId] = useState<number | null>(null);

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  async function loadQuestions() {
    try {
      setLoading(true);
      setError("");

      const data = await getSellerQuestions();

      setQuestions(data);
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudieron cargar las preguntas."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQuestions();
  }, []);

  async function handleAnswer(question: SellerQuestion) {
    const answer = answers[question.id]?.trim();

    if (!answer) {
      setError("Escribí una respuesta antes de publicarla.");
      return;
    }

    try {
      setSendingId(question.id);
      setError("");
      setMessage("");

      await answerSellerQuestion(question.id, answer);

      setAnswers((current) => ({
        ...current,
        [question.id]: "",
      }));

      setMessage("Respuesta publicada correctamente.");

      await loadQuestions();
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo responder la pregunta."
        )
      );
    } finally {
      setSendingId(null);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-2xl font-bold">
          Preguntas de compradores
        </h2>

        <p className="mt-1 text-gray-600">
          Respondé consultas sobre tus productos.
        </p>
      </div>

      {error && (
        <div className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mt-5 rounded-lg bg-green-50 p-4 text-green-700">
          {message}
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-gray-600">
          Cargando preguntas...
        </p>
      ) : questions.length === 0 ? (
        <div className="mt-6 rounded-xl bg-gray-50 p-8 text-center">
          <p className="text-gray-600">
            No hay preguntas para responder.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {questions.map((question) => (
            <article
              key={question.id}
              className="rounded-xl border border-gray-200 p-5"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row">
                <div>
                  <p className="text-sm font-semibold text-green-700">
                    {question.product_name || "Producto"}
                  </p>

                  <p className="mt-3 text-lg font-semibold">
                    {question.question}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    Pregunta realizada por {question.user_name}
                  </p>
                </div>

                <span
                  className={
                    question.answer
                      ? "h-fit rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"
                      : "h-fit rounded-full bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700"
                  }
                >
                  {question.answer ? "Respondida" : "Pendiente"}
                </span>
              </div>

              {question.answer ? (
                <div className="mt-5 rounded-lg bg-green-50 p-4">
                  <p className="text-xs font-bold uppercase text-green-700">
                    Tu respuesta
                  </p>

                  <p className="mt-2 text-gray-800">
                    {question.answer}
                  </p>

                  {question.answered_at && (
                    <p className="mt-3 text-xs text-gray-500">
                      {new Date(
                        question.answered_at
                      ).toLocaleString("es-AR")}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-5">
                  <label className="mb-2 block text-sm font-medium">
                    Respuesta
                  </label>

                  <textarea
                    rows={4}
                    placeholder="Escribí una respuesta clara para el comprador..."
                    value={answers[question.id] || ""}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-700"
                  />

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      disabled={sendingId === question.id}
                      onClick={() => handleAnswer(question)}
                      className="rounded-lg bg-green-700 px-5 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-50"
                    >
                      {sendingId === question.id
                        ? "Publicando..."
                        : "Publicar respuesta"}
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}