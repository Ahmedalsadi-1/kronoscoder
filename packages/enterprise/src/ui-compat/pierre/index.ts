import { type FileDiffOptions } from "@pierre/diffs"

export function createDefaultOptions<T>(style: FileDiffOptions<T>["diffStyle"]) {
  return {
    theme: "KronosCode",
    themeType: "system",
    disableLineNumbers: false,
    overflow: "wrap",
    diffStyle: style ?? "unified",
    diffIndicators: "bars",
    lineHoverHighlight: "both",
    disableBackground: false,
    expansionLineCount: 20,
    hunkSeparators: "line-info-basic",
    lineDiffType: style === "split" ? "word-alt" : "none",
    maxLineDiffLength: 1000,
    maxLineLengthForHighlighting: 1000,
    disableFileHeader: true,
  } as const
}
