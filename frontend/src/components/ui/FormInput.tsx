import { useId, type InputHTMLAttributes } from "react";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function FormInput({ label, error, id, ...props}: FormInputProps) {
    const generateId = useId();
    const inputId = id || generateId;
    const errorId = `${inputId}-error`;

    return (
        <div>
        <label
            htmlFor={inputId}
            className="mb-1 block text-sm font-medium text-gray-700"
        >
            {label}
        </label>

        <input
            {...props}
            id={inputId}
            aria-invalid={
            Boolean(error)
            }
            aria-describedby={
            error
                ? errorId
                : undefined
            }
            className={`w-full rounded-lg border px-3 py-2 outline-none transition focus:ring-2 focus:ring-green-200 ${
            error
                ? "border-red-500 focus:border-red-500"
                : "border-gray-300 focus:border-green-700"
            }`}
        />

        {error && (
            <p
            id={errorId}
            role="alert"
            className="mt-1 text-sm text-red-600"
            >
            {error}
            </p>
        )}
        </div>
    );

}