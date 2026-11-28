import "@testing-library/jest-dom/vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect, vi } from "vitest";

expect.extend(matchers);
window.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  cleanup();
});
