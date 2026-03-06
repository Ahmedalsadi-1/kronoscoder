import { SECRET } from "./secret"
import { domain, shortDomain } from "./stage"

const storage = new sst.cloudflare.Bucket("EnterpriseStorage")

const teams = new sst.cloudflare.x.SolidStart("Teams", {
  domain: shortDomain,
  path: "packages/enterprise",
  buildCommand: "bun run build:cloudflare",
  environment: {
    KRONOSCODE_STORAGE_ADAPTER: "r2",
    KRONOSCODE_STORAGE_ACCOUNT_ID: sst.cloudflare.DEFAULT_ACCOUNT_ID,
    KRONOSCODE_STORAGE_ACCESS_KEY_ID: SECRET.R2AccessKey.value,
    KRONOSCODE_STORAGE_SECRET_ACCESS_KEY: SECRET.R2SecretKey.value,
    KRONOSCODE_STORAGE_BUCKET: storage.name,
  },
})
