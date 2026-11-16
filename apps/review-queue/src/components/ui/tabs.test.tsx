import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

describe("TabsContent", () => {
  it("keeps the global keyboard focus outline on the panel", () => {
    render(
      <Tabs defaultValue="notes">
        <TabsList>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>
        <TabsContent value="notes">Body</TabsContent>
      </Tabs>,
    );

    expect(screen.getByRole("tabpanel").classList.contains("outline-none")).toBe(false);
  });
});
