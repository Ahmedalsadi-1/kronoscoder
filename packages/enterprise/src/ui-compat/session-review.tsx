import { For } from "solid-js"

type DiffRow = {
  file?: string
  status?: string
}

type Props = {
  diffs: DiffRow[]
  split?: boolean
  class?: string
  classes?: {
    root?: string
    header?: string
    container?: string
  }
}

export function SessionReview(props: Props) {
  return (
    <section class={[props.class ?? "", props.classes?.root ?? ""].join(" ").trim()}>
      <div class={["mb-3 text-12-mono text-text-weaker", props.classes?.header ?? ""].join(" ").trim()}>
        {props.split ? "Split Diff" : "Unified Diff"} ({props.diffs.length} files)
      </div>
      <div class={["flex flex-col gap-2", props.classes?.container ?? ""].join(" ").trim()}>
        <For each={props.diffs}>
          {(diff) => (
            <div class="rounded border border-border-weak-base bg-background-base px-3 py-2 text-12-regular">
              <div class="font-medium">{diff.file ?? "unknown file"}</div>
              <div class="text-text-weaker">{diff.status ?? "changed"}</div>
            </div>
          )}
        </For>
      </div>
    </section>
  )
}
