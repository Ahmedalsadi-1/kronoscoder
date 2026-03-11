declare module "rate-limit-redis" {
  type SendCommand = (...args: string[]) => Promise<unknown> | unknown

  interface RedisStoreOptions {
    sendCommand: SendCommand
    prefix?: string
    resetExpiryOnChange?: boolean
  }

  export default class RedisStore {
    constructor(options: RedisStoreOptions)
  }
}
