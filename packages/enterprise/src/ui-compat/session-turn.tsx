import { ParentProps } from "solid-js"

type Props = ParentProps<{
  sessionID: string
  messageID: string
  classes?: {
    root?: string
    content?: string
    container?: string
  }
}>

export function SessionTurn(props: Props) {
  return (
    <section class={props.classes?.root} data-session={props.sessionID} data-message={props.messageID}>
      <div class={props.classes?.content}>
        <div class={props.classes?.container}>
          <div class="mb-2 text-12-mono text-text-weaker">Message {props.messageID.slice(0, 8)}</div>
          {props.children}
        </div>
      </div>
    </section>
  )
}
