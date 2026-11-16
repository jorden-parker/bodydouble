import { describe, expect, it } from "vitest";
import { nextRowIndex, queueKeyAction } from "./queue-keys";

const press = (key: string, overrides: { hasModifier?: boolean; isTyping?: boolean } = {}) => ({
  key,
  hasModifier: false,
  isTyping: false,
  ...overrides,
});

describe("queueKeyAction", () => {
  it("maps j, k, s, e and r to the queue actions", () => {
    expect(queueKeyAction(press("j"))).toBe("next");
    expect(queueKeyAction(press("k"))).toBe("previous");
    expect(queueKeyAction(press("s"))).toBe("snooze");
    expect(queueKeyAction(press("e"))).toBe("archive");
    expect(queueKeyAction(press("r"))).toBe("refresh");
  });

  it("ignores other keys, including capitals and Enter, which the focused link handles", () => {
    expect(queueKeyAction(press("J"))).toBeNull();
    expect(queueKeyAction(press("Enter"))).toBeNull();
    expect(queueKeyAction(press("constructor"))).toBeNull();
  });

  it("ignores every key while a modifier is held or the reader is typing", () => {
    expect(queueKeyAction(press("j", { hasModifier: true }))).toBeNull();
    expect(queueKeyAction(press("j", { isTyping: true }))).toBeNull();
  });
});

describe("nextRowIndex", () => {
  it("moves one row at a time and stays inside the list", () => {
    expect(nextRowIndex(-1, 3, 1)).toBe(0);
    expect(nextRowIndex(0, 3, 1)).toBe(1);
    expect(nextRowIndex(2, 3, 1)).toBe(2);
    expect(nextRowIndex(0, 3, -1)).toBe(0);
  });
});
