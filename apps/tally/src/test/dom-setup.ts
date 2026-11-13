import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

class InertResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = InertResizeObserver;

afterEach(cleanup);
