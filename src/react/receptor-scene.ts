import * as T from 'three'
import cgrpCoordinates from './data/6e3y.json' with { type: 'json' }
import pacapCoordinates from './data/6m1i.json' with { type: 'json' }
import secondaryStructure from './data/receptor-helices.json' with { type: 'json' }
import { finish, mesh, tube } from './scene-geometry.js'
import type { Pathway } from '../core/index.js'

type Coordinates = Record<string, number[][]>
type Helices = Record<string, number[][]>

const structures: Record<Pathway, { coordinates: Coordinates; helices: Helices; main: string; peptide: string; split: number }> = {
  cgrp: { coordinates: cgrpCoordinates, helices: secondaryStructure['6e3y'], main: 'R', peptide: 'P', split: 118 },
  pacap: { coordinates: pacapCoordinates, helices: secondaryStructure['6m1i'], main: 'A', peptide: 'B', split: 136 },
}

function ribbon(parent: T.Group, path: T.CatmullRomCurve3, halfWidth: number, material: T.Material) {
  const steps = path.points.length * 5
  const frames = path.computeFrenetFrames(steps, false)
  const vertices: number[] = []
  const indices: number[] = []
  const sections = 8
  for (let i = 0; i <= steps; i++) {
    const point = path.getPointAt(i / steps)
    const taper = 0.66 + 0.34 * Math.min(1, i / 5, (steps - i) / 5)
    for (let j = 0; j < sections; j++) {
      const angle = j * Math.PI * 2 / sections
      const p = point.clone().addScaledVector(frames.normals[i], Math.cos(angle) * halfWidth * taper)
        .addScaledVector(frames.binormals[i], Math.sin(angle) * halfWidth * 0.28)
      vertices.push(p.x, p.y, p.z)
      if (i) {
        const a = (i - 1) * sections + j
        const b = (i - 1) * sections + (j + 1) % sections
        indices.push(a, a + sections, b, b, a + sections, b + sections)
      }
    }
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  mesh(parent, geometry, material)
}

export function makeStructure(pathway: Pathway) {
  const { coordinates, helices, main, peptide, split } = structures[pathway]
  const group = new T.Group()
  const backbone = new T.Group()
  group.add(backbone)

  const receptor = finish('#987567', { roughness: 0.60, side: T.DoubleSide })
  const companion = finish('#6a8773', { roughness: 0.72, side: T.DoubleSide })
  const ligandColor = pathway === 'cgrp' ? '#da9c32' : '#60a48d'
  const agonist = finish(ligandColor, { emissive: ligandColor, emissiveIntensity: 0.17, side: T.DoubleSide })
  const position = (row: number[]) => new T.Vector3(row[1], row[2], row[3])
  const average = (rows: number[][]) => rows.reduce((sum, row) => sum.add(position(row)), new T.Vector3()).divideScalar(rows.length)
  const upper = average(coordinates[main].filter(row => row[0] < split))
  const center = average(coordinates[main].filter(row => row[0] >= split))
  const upright = new T.Quaternion().setFromUnitVectors(upper.sub(center).normalize(), new T.Vector3(0, 1, 0))

  for (const [chain, rows] of Object.entries(coordinates)) {
    const material = chain === main ? receptor : chain === peptide ? agonist : companion
    const ranges = helices[chain] ?? []
    let segment: T.Vector3[] = []
    let lastHelix = -1
    function drawSegment() {
      if (segment.length < 2) return
      const path = new T.CatmullRomCurve3(segment)
      if (lastHelix >= 0 && segment.length > 3) ribbon(backbone, path, chain === peptide ? 1.32 : 1.48, material)
      else tube(backbone, path, chain === peptide ? 0.85 : 0.62, material, segment.length * 4)
    }
    rows.forEach((row, index) => {
      const point = position(row).sub(center).applyQuaternion(upright)
      const helix = ranges.findIndex(([first, last]) => row[0] >= first && row[0] <= last)
      const previous = segment[segment.length - 1]
      if (previous) {
        const gap = row[0] - rows[index - 1][0] > 1 || point.distanceTo(previous) > 5
        if (gap || helix !== lastHelix) {
          drawSegment()
          segment = gap ? [] : [previous]
        }
      }
      segment.push(point)
      lastHelix = helix
    })
    drawSegment()
  }

  const bounds = new T.Box3().setFromObject(backbone)
  const size = bounds.getSize(new T.Vector3())
  const factor = 5.25 / Math.max(size.x, size.y, size.z)
  backbone.scale.setScalar(factor)
  backbone.position.copy(bounds.getCenter(new T.Vector3()).multiplyScalar(-factor))

  const membrane = new T.Group()
  membrane.position.set(backbone.position.x, backbone.position.y, backbone.position.z)
  group.add(membrane)
  const rim = new T.MeshBasicMaterial({ color: '#788c7e', transparent: true, opacity: 0.57 })
  const bilayer = finish('#86a08b', { transparent: true, opacity: 0.19, depthWrite: false, roughness: 0.76 })
  const radius = 2.08
  for (const y of [-0.56, 0.56]) {
    const layer = mesh(membrane, new T.CylinderGeometry(radius, radius, 0.032, 72, 1, false), bilayer)
    layer.position.y = y
    const border = mesh(membrane, new T.TorusGeometry(radius, 0.018, 8, 72), rim)
    border.position.y = y
    border.rotation.x = Math.PI / 2
  }
  const heads = new T.InstancedMesh(new T.SphereGeometry(0.035, 7, 6), rim, 144)
  const transform = new T.Matrix4()
  for (let i = 0; i < 72; i++) {
    const angle = i * Math.PI * 2 / 72
    for (const [layer, y] of [[0, -0.56], [1, 0.56]] as const) {
      transform.makeTranslation(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
      heads.setMatrixAt(i * 2 + layer, transform)
    }
  }
  membrane.add(heads)
  return group
}
