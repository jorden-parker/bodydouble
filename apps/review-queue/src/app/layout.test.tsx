import { describe, expect, it, vi } from "vitest";
import RootLayout from "./layout";

vi.mock("next/font/google", () => ({
  Atkinson_Hyperlegible: vi.fn((options: { variable: string }) => ({ variable: options.variable })),
  JetBrains_Mono: vi.fn((options: { variable: string }) => ({ variable: options.variable })),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

function htmlClassNames(): string[] {
  const htmlElement = RootLayout({ children: null });
  return String(htmlElement.props.className).split(" ");
}

describe("RootLayout fonts", () => {
  it("no longer loads the Fredoka display face", () => {
    expect(htmlClassNames()).not.toContain("--font-fredoka");
  });

  it("puts the Atkinson Hyperlegible body variable on the html element", () => {
    expect(htmlClassNames()).toContain("--font-atkinson");
  });

  it("puts the JetBrains Mono code variable on the html element", () => {
    expect(htmlClassNames()).toContain("--font-jetbrains-mono");
  });

  it("no longer loads Geist", () => {
    expect(htmlClassNames().some((name) => name.startsWith("--font-geist"))).toBe(false);
  });
});
