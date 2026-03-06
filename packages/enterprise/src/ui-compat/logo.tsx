type Props = {
  class?: string
}

export function Mark(props: Props) {
  return <span class={props.class}>K</span>
}

export function Logo(props: Props) {
  return (
    <div class={props.class} aria-label="KronosCode">
      <Mark />
    </div>
  )
}

export function Splash(props: Props) {
  return <Logo class={props.class} />
}
