import { describe, expect, it, vi } from "vitest";
import RootLayout from "./layout";

vi.mock("next/font/google", () => ({
  Geist: vi.fn((options: { variable: string }) => ({ variable: options.variable })),
  Geist_Mono: vi.fn((options: { variable: string }) => ({ variable: options.variable })),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

function htmlClassNames(): string[] {
  const htmlElement = RootLayout({ children: null });
  return String(htmlElement.props.className).split(" ");
}

describe("RootLayout fonts", () => {
  it("puts the Geist sans variable on the html element", () => {
    expect(htmlClassNames()).toContain("--font-geist-sans");
  });

  it("puts the Geist Mono variable on the html element", () => {
    expect(htmlClassNames()).toContain("--font-geist-mono");
  });

  it("no longer loads Atkinson Hyperlegible or JetBrains Mono", () => {
    const names = htmlClassNames();
    expect(names.some((name) => name.includes("atkinson"))).toBe(false);
    expect(names.some((name) => name.includes("jetbrains"))).toBe(false);
  });
});
