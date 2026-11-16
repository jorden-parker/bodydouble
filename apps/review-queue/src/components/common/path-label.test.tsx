import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PathLabel } from "./path-label";

const LONG_PATH = "src/components/review/very-long-directory/use-step-navigation.ts";

describe("PathLabel", () => {
  it("truncates a long path so the file name stays visible and no word breaks", () => {
    render(<PathLabel path={LONG_PATH} />);
    const label = screen.getByTitle(LONG_PATH);
    expect(label.classList).toContain("truncate");
    expect(label.classList).not.toContain("wrap-anywhere");
  });
});
