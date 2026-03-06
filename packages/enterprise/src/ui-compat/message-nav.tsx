import { For } from "solid-js"

type Message = {
  id: string
}

type Props = {
  messages: Message[]
  current?: Message
  size?: "compact" | "regular"
  class?: string
  onMessageSelect: (message: Message) => void
}

export function MessageNav(props: Props) {
  return (
    <div class={props.class}>
      <div class="flex flex-col gap-1">
        <For each={props.messages}>
          {(message, index) => (
            <button
              type="button"
              class="h-7 rounded border border-border-weak-base px-2 text-12-mono"
              data-selected={props.current?.id === message.id ? "" : undefined}
              onClick={() => props.onMessageSelect(message)}
              title={message.id}
            >
              {index() + 1}
            </button>
          )}
        </For>
      </div>
    </div>
  )
}
