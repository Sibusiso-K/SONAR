import { describe, expect, it } from "vitest";
import { isCareerKind, kindName, moneyLabel } from "./kinds";

describe("kinds", () => {
  it("treats internships and graduate programmes as hiring, not contests", () => {
    expect(isCareerKind("internship")).toBe(true);
    expect(isCareerKind("grad_programme")).toBe(true);
    expect(isCareerKind("hackathon")).toBe(false);
    expect(isCareerKind("competition")).toBe(false);
  });

  it("names the money by what it is", () => {
    expect(moneyLabel("hackathon")).toBe("prize");
    expect(moneyLabel("internship")).toBe("stipend");
    expect(moneyLabel("grad_programme")).toBe("salary");
    expect(moneyLabel("grant")).toBe("award");
  });

  it("gives readers a name for each family", () => {
    expect(kindName("internship")).toBe("Internship");
    expect(kindName("grad_programme")).toBe("Graduate programme");
    expect(kindName("ml_competition")).toBe("Competition");
    expect(kindName("hackathon")).toBe("Hackathon");
  });

  it("falls back to the raw kind for one it does not know", () => {
    expect(kindName("weird_kind")).toBe("weird kind");
    expect(kindName(null)).toBe("unknown");
    expect(moneyLabel(undefined)).toBe("prize");
  });
});
