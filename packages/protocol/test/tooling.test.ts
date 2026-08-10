import { expect, test } from "vitest"
import { z } from "zod"

test("runs TypeScript tests with the protocol schema dependency", () => {
  expect(z.literal("kaxu").parse("kaxu")).toBe("kaxu")
})
