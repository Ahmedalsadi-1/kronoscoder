import { ParentProps } from "solid-js"

type Props = ParentProps<{
  class?: string
}>

export function Diff(props: Props) {
  return <div class={props.class}>{props.children}</div>
}
