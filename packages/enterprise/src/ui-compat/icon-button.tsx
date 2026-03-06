import { JSX } from "solid-js"

type Props = {
  as?: "a" | "button"
  href?: string
  target?: string
  icon?: string
  variant?: "ghost" | string
  class?: string
  children?: JSX.Element
  onClick?: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent>
}

function icon(name?: string) {
  if (name === "github") return "GH"
  if (name === "discord") return "DS"
  return "•"
}

export function IconButton(props: Props) {
  const cls = () => [
    "inline-flex h-8 w-8 items-center justify-center rounded border border-border-weak-base text-12-mono",
    props.variant === "ghost" ? "bg-transparent" : "bg-background-base",
    props.class ?? "",
  ].join(" ")

  if (props.as === "a") {
    return (
      <a href={props.href} target={props.target} rel={props.target === "_blank" ? "noreferrer" : undefined} class={cls()}>
        {props.children ?? icon(props.icon)}
      </a>
    )
  }

  return (
    <button type="button" onClick={props.onClick} class={cls()}>
      {props.children ?? icon(props.icon)}
    </button>
  )
}
