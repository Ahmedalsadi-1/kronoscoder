import { describe, expect, test } from "bun:test"
import { clearSequence, command, putSequence, split } from "../../../src/cli/cmd/tui/util/kitty-graphics"

describe("kitty-graphics", () => {
  test("builds payload and non-payload kitty commands", () => {
    const plain = command("a=p,q=2")
    const withPayload = command("a=t,m=0", "AAAA")

    expect(plain).toBe("\x1b_Ga=p,q=2\x1b\\")
    expect(withPayload).toBe("\x1b_Ga=t,m=0;AAAA\x1b\\")
  })

  test("splits payload deterministically", () => {
    expect(split("", 2)).toEqual([])
    expect(split("ABCDE", 2)).toEqual(["AB", "CD", "E"])
  })

  test("creates absolute cursor placement sequence", () => {
    const seq = putSequence({
      imageID: 10,
      placementID: 4,
      x: 5,
      y: 7,
      width: 40,
      height: 20,
    })

    expect(seq).toContain("\x1b[8;6H")
    expect(seq).toContain("a=p,q=2,i=10,p=4,c=40,r=20,C=1,z=10")
  })

  test("creates clear sequence for image or placement", () => {
    expect(clearSequence({ imageID: 11 })).toContain("a=d,d=i,q=2,i=11")
    expect(clearSequence({ imageID: 11, placementID: 2 })).toContain("a=d,d=i,q=2,i=11,p=2")
  })
})
