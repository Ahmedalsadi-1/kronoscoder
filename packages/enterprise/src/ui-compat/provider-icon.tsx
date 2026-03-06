import type { IconName } from "./icons/provider"

type Props = {
  id?: IconName
  class?: string
}

export function ProviderIcon(props: Props) {
  const text = () => (props.id && props.id.length > 0 ? props.id[0].toUpperCase() : "?")
  return (
    <span class={props.class} title={props.id ?? "provider"} aria-label={props.id ?? "provider"}>
      {text()}
    </span>
  )
}
