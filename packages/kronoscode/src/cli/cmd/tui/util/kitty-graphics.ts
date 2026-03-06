const chunkSize = 4096
const uploads = new Map<string, number>()

let image = 1000
let placement = 1

export function command(params: string, payload?: string) {
  if (!payload) return `\x1b_G${params}\x1b\\`
  return `\x1b_G${params};${payload}\x1b\\`
}

function write(data: string) {
  if (!process.stdout.isTTY) return
  process.stdout.write(data)
}

export function split(input: string, size: number) {
  if (input.length === 0) return []
  const out: string[] = []
  let i = 0
  while (i < input.length) {
    out.push(input.slice(i, i + size))
    i += size
  }
  return out
}

export function nextPlacement() {
  placement += 1
  return placement
}

export async function upload(input: { key: string; path: string }) {
  const cached = uploads.get(input.key)
  if (cached) return { imageID: cached }

  const file = Bun.file(input.path)
  const bytes = await file.arrayBuffer().catch(() => undefined)
  if (!bytes) {
    return {
      error: `Failed to read image: ${input.path}`,
    }
  }

  const id = image++
  const data = Buffer.from(bytes).toString("base64")
  const parts = split(data, chunkSize)
  if (parts.length === 0) {
    return {
      error: `No image payload for ${input.path}`,
    }
  }

  parts.forEach((part, index) => {
    write(command(`a=t,t=d,f=100,q=2,i=${id},m=${index < parts.length - 1 ? 1 : 0}`, part))
  })

  uploads.set(input.key, id)
  return { imageID: id }
}

export function putSequence(input: {
  imageID: number
  placementID: number
  x: number
  y: number
  width: number
  height: number
  z?: number
}) {
  const row = Math.max(1, input.y + 1)
  const col = Math.max(1, input.x + 1)
  const width = Math.max(1, input.width)
  const height = Math.max(1, input.height)
  const z = input.z ?? 10
  return `\x1b7\x1b[${row};${col}H${command(`a=p,q=2,i=${input.imageID},p=${input.placementID},c=${width},r=${height},C=1,z=${z}`)}\x1b8`
}

export function put(input: {
  imageID: number
  placementID: number
  x: number
  y: number
  width: number
  height: number
  z?: number
}) {
  write(putSequence(input))
}

export function clearSequence(input: { imageID: number; placementID?: number }) {
  if (typeof input.placementID === "number") return command(`a=d,d=i,q=2,i=${input.imageID},p=${input.placementID}`)
  return command(`a=d,d=i,q=2,i=${input.imageID}`)
}

export function clear(input: { imageID: number; placementID?: number }) {
  write(clearSequence(input))
}

export function reset() {
  write(command("a=d,d=A,q=2"))
}
