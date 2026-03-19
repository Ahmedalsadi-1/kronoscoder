#!/usr/bin/env python3
import json
import re
import sys
from dataclasses import dataclass
from typing import Dict, List, Tuple


@dataclass(frozen=True)
class Target:
    name: str
    path: str
    commands: List[str]
    keywords: List[str]
    guardrails: List[str]


TARGETS: List[Target] = [
    Target(
        name="core-engine",
        path="packages/kronoscode",
        commands=[
            "cd packages/kronoscode && bun run dev",
            "cd packages/kronoscode && bun test --timeout 30000",
        ],
        keywords=[
            "engine",
            "mcp",
            "lsp",
            "session",
            "orchestration",
            "tool calling",
            "runtime",
            "cli",
        ],
        guardrails=[
            "Do not import deprecated server routes.",
            "Use async queue-based flows, not sync installation flows.",
        ],
    ),
    Target(
        name="chamber-runtime-ui",
        path="kronosChamber",
        commands=[
            "cd kronosChamber && bun run dev",
            "cd kronosChamber && bun run desktop:dev",
            "cd kronosChamber && bun run vscode:dev",
        ],
        keywords=[
            "chamber",
            "web",
            "desktop ui",
            "vscode",
            "panel",
            "sidebar",
            "settings",
            "layout",
        ],
        guardrails=[
            "Validate shared UI behavior across desktop and VS Code when relevant.",
            "Keep UI edits token-based and consistent with shared components.",
        ],
    ),
    Target(
        name="shared-ui",
        path="packages/ui",
        commands=[
            "cd packages/ui && bun run typecheck",
            "cd packages/ui && bun test --timeout 30000",
        ],
        keywords=[
            "token",
            "typography",
            "component",
            "theme",
            "icon",
            "primitive",
            "design system",
        ],
        guardrails=[
            "Never hardcode HEX or RGB values.",
            "Use semantic typography classes and shared components.",
        ],
    ),
    Target(
        name="sdk-contracts",
        path="packages/sdk",
        commands=[
            "cd packages/sdk && bun run typecheck",
        ],
        keywords=[
            "openapi",
            "sdk",
            "client types",
            "generated types",
            "api contract",
        ],
        guardrails=[
            "Regenerate and verify type-safe API surfaces after contract changes.",
        ],
    ),
    Target(
        name="desktop-packaging",
        path="packages/desktop",
        commands=[
            "cd packages/desktop && bun run typecheck",
        ],
        keywords=[
            "tauri",
            "tray",
            "native",
            "installer",
            "packaging",
        ],
        guardrails=[
            "Keep native wrapper changes isolated from runtime UI logic.",
        ],
    ),
]


def normalize(text: str) -> str:
    text = text.lower()
    return re.sub(r"\s+", " ", text).strip()


def score_target(text: str, target: Target) -> Tuple[int, List[str]]:
    score = 0
    hits: List[str] = []
    for keyword in target.keywords:
        if keyword in text:
            score += 2 if " " in keyword else 1
            hits.append(keyword)

    # Light tie-breakers for common user wording.
    if target.path == "kronosChamber" and any(k in text for k in ["ui", "screen", "view"]):
        score += 1
    if target.path == "packages/kronoscode" and any(k in text for k in ["agent", "core", "tool"]):
        score += 1
    if target.path == "packages/ui" and any(k in text for k in ["button", "card", "theme"]):
        score += 1

    return score, hits


def classify(text: str) -> Dict[str, object]:
    scored = []
    for target in TARGETS:
        score, hits = score_target(text, target)
        scored.append((target, score, hits))

    scored.sort(key=lambda item: item[1], reverse=True)
    top = scored[0]
    second = scored[1]

    total = sum(item[1] for item in scored)
    confidence = (top[1] / total) if total > 0 else 0.0
    cross_package = (top[1] == second[1] and top[1] > 0) or (confidence < 0.45)

    result = {
        "query": text,
        "top_target": {
            "name": top[0].name,
            "path": top[0].path,
            "score": top[1],
            "hits": top[2],
            "commands": top[0].commands,
            "guardrails": top[0].guardrails,
        },
        "runner_up": {
            "name": second[0].name,
            "path": second[0].path,
            "score": second[1],
            "hits": second[2],
            "commands": second[0].commands,
        },
        "confidence": round(confidence, 2),
        "cross_package": cross_package,
        "global_checks": [
            "Use nearest AGENTS.md before editing.",
            "Run package-level checks first.",
            "Avoid root bun test (disabled).",
        ],
    }
    return result


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: route_kronos_intent.py \"<request text>\"")
        return 1

    query = normalize(" ".join(sys.argv[1:]))
    print(json.dumps(classify(query), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
