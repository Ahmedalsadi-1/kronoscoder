import { ParentProps } from "solid-js"

type Props = ParentProps<{
  class?: string
}>

export function Code(props: Props) {
  return <code class={props.class}>{props.children}</code>
}
