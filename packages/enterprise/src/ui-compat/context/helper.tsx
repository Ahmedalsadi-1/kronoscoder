import { ParentProps, createContext, useContext } from "solid-js"

export function createSimpleContext<T, P extends object>(config: {
  name: string
  init: (props: P) => T
}) {
  const ctx = createContext<T>()

  function Provider(props: ParentProps<P>) {
    return <ctx.Provider value={config.init(props as P)}>{props.children}</ctx.Provider>
  }

  function use() {
    const value = useContext(ctx)
    if (value === undefined) {
      throw new Error(`${config.name} context missing`)
    }
    return value
  }

  return {
    provider: Provider,
    use,
  }
}
