import { readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const data = new URL('../src/react/data/', import.meta.url)
// Lazy modules let consumers load each figure without configuring a public asset path.
for (const name of ['adult-woman', 'adult-man', 'human-brain']) {
  const model = gzipSync(await readFile(new URL(name + '.glb', data)), { level: 9 })
  const module = 'export const modelGzip: string = ' + JSON.stringify(model.toString('base64')) + '\n'
  const target = new URL(name + '-data.ts', data)
  const previous = await readFile(target, 'utf8').catch(error => {
    if (error.code !== 'ENOENT') throw error
  })
  if (previous !== module) await writeFile(target, module)
}
