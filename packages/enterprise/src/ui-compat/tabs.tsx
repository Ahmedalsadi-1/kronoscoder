import { Accessor, JSX, ParentProps, createContext, createSignal, useContext } from "solid-js"

type ClassList = Record<string, boolean | undefined>

type TabsState = {
  value: Accessor<string>
  setValue: (next: string) => void
}

const ctx = createContext<TabsState>()

function useTabs() {
  const value = useContext(ctx)
  if (!value) {
    throw new Error("Tabs context missing")
  }
  return value
}

type TabsProps = ParentProps<{
  defaultValue?: string
  class?: string
  classList?: ClassList
}>

function Root(props: TabsProps) {
  const [value, setValue] = createSignal(props.defaultValue ?? "session")
  return (
    <ctx.Provider value={{ value, setValue }}>
      <div class={props.class} classList={props.classList}>{props.children}</div>
    </ctx.Provider>
  )
}

function List(props: ParentProps<{ class?: string; classList?: ClassList }>) {
  return <div class={props.class} classList={props.classList}>{props.children}</div>
}

type TriggerProps = ParentProps<{
  value: string
  class?: string
  classList?: ClassList
  classes?: {
    button?: string
  }
}>

function Trigger(props: TriggerProps) {
  const tabs = useTabs()
  const selected = () => tabs.value() === props.value
  return (
    <button
      type="button"
      class={[props.class ?? "", props.classes?.button ?? ""].join(" ").trim()}
      classList={props.classList}
      data-selected={selected() ? "" : undefined}
      onClick={() => tabs.setValue(props.value)}
    >
      {props.children}
    </button>
  )
}

type ContentProps = ParentProps<{
  value: string
  forceMount?: boolean
  class?: string
  classList?: ClassList
}>

function Content(props: ContentProps) {
  const tabs = useTabs()
  const selected = () => tabs.value() === props.value
  if (!props.forceMount && !selected()) return null
  return (
    <div
      class={props.class}
      classList={{
        ...(props.classList ?? {}),
        hidden: props.forceMount ? !selected() : false,
      }}
      data-selected={selected() ? "" : undefined}
    >
      {props.children}
    </div>
  )
}

type TabsCompound = typeof Root & {
  List: typeof List
  Trigger: typeof Trigger
  Content: typeof Content
}

export const Tabs = Object.assign(Root, {
  List,
  Trigger,
  Content,
}) as TabsCompound
