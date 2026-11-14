import { copyFile, mkdir } from 'node:fs/promises'

const source = new URL('../src/react/', import.meta.url)
const dist = new URL('../dist/', import.meta.url)
await mkdir(new URL('data/', dist), { recursive: true })
await Promise.all(['styles.css', 'data/migraine-cutaway.webp', 'data/migraine-vision.webp'].map(file =>
  copyFile(new URL(file, source), new URL(file, dist)),
))
