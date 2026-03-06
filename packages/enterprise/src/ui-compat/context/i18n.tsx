import { Accessor, createContext, useContext } from "solid-js"

export type UiI18nParams = Record<string, string | number | boolean | undefined>

export type UiI18nState = {
  locale: Accessor<string>
  t: (key: string, params?: UiI18nParams) => string
}

const ctx = createContext<UiI18nState>()

export const I18nProvider = ctx.Provider

export function useI18n() {
  const value = useContext(ctx)
  if (!value) {
    throw new Error("I18n context missing")
  }
  return value
}
