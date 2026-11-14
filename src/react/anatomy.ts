import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import type { BodyModel } from '../core/index.js'

export async function decodeModel(modelGzip: string) {
  const compressed = Uint8Array.from(atob(modelGzip), character => character.charCodeAt(0))
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))
  const buffer = await new Response(stream).arrayBuffer()
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, '')
}

export async function loadAnatomy(body: BodyModel) {
  const { modelGzip } = body === 'female'
    ? await import('./data/adult-woman-data.js')
    : await import('./data/adult-man-data.js')
  const { scene } = await decodeModel(modelGzip)
  const figure = scene.getObjectByName('Figure')
  const cutaway = scene.getObjectByName('Cutaway')
  if (!figure || !(cutaway instanceof T.Mesh)) throw new Error('Missing figure or head mesh')
  return { figure, cutaway }
}

export async function loadBrain() {
  const { modelGzip } = await import('./data/human-brain-data.js')
  const { scene } = await decodeModel(modelGzip)
  return scene
}
