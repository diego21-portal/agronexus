import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  createProductQuestion,
  getProductQuestions,
} from "../../services/productSocialService";
import type { ProductQuestion } from "../../types/productSocial";

interface ProductQuestionsSectionProps {
  slug: string;
}

export function ProductQuestionsSection({
  slug,
}: ProductQuestionsSectionProps) {
  const { authenticated } = useAuth();

  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadQuestions() {
    try {
      setLoading(true);
      setError("");

      const data = await getProductQuestions(slug);
      setQuestions(data);
    } catch {
      setError("No se pudieron cargar las preguntas.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (question.trim().length < 5) {
      setError("La pregunta debe tener al menos 5 caracteres.");
      return;
    }

    try {
      setSending(true);
      setError("");
      setMessage("");

      await createProductQuestion(slug, {
        question: question.trim(),
      });

      setQuestion("");
      setMessage(
        "Pregunta enviada. Será visible públicamente cuando el vendedor la responda."
      );
    } catch {
      setError("No se pudo enviar la pregunta.");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    loadQuestions();
  }, [slug]);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold">Preguntas al vendedor</h2>

      <p className="mt-1 text-sm text-gray-600">
        Consultá compatibilidad, envío, garantía o características técnicas.
      </p>

      {authenticated ? (
        <form onSubmit={handleSubmit} className="mt-5">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Escribí tu pregunta..."
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-700"
          />

          <button
            disabled={sending}
            className="mt-2 rounded-lg bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-60"
          >
            {sending ? "Enviando..." : "Enviar pregunta"}
          </button>
        </form>
      ) : (
        <p className="mt-5 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
          Iniciá sesión para hacer una pregunta.
        </p>
      )}

      {message && (
        <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {message}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-7 space-y-4">
        {loading ? (
          <p className="text-gray-600">Cargando preguntas...</p>
        ) : questions.length === 0 ? (
          <p className="text-gray-600">
            Este producto todavía no tiene preguntas respondidas.
          </p>
        ) : (
          questions.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-gray-200 p-4"
            >
              <div className="flex gap-3">
                <span className="font-bold text-green-700">P:</span>

                <div>
                  <p className="font-medium">{item.question}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {item.user_name}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex gap-3 rounded-lg bg-gray-50 p-3">
                <span className="font-bold text-gray-700">R:</span>

                <div>
                  <p>{item.answer}</p>

                  {item.answered_by_name && (
                    <p className="mt-1 text-xs text-gray-500">
                      Respondido por {item.answered_by_name}
                    </p>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}