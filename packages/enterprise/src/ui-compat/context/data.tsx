import { ParentProps } from "solid-js"
import { createSimpleContext } from "./helper"

type DataState = {
  data: unknown
  directory?: string
}

const ctx = createSimpleContext<DataState, DataState>({
  name: "Data",
  init: (props) => ({
    data: props.data,
    directory: props.directory,
  }),
})

export function DataProvider(props: ParentProps<DataState>) {
  return <ctx.provider data={props.data} directory={props.directory}>{props.children}</ctx.provider>
}

export const useData = ctx.use
