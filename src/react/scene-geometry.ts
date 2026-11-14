import * as T from 'three'

export type Point = [number, number, number]
export const v = (point: Point) => new T.Vector3(...point)
export const finish = (color: string, options: T.MeshStandardMaterialParameters = {}) =>
  new T.MeshStandardMaterial({ color, roughness: 0.59, ...options })

export function mesh<Material extends T.Material>(parent: T.Object3D, geometry: T.BufferGeometry, material: Material) {
  const object = new T.Mesh(geometry, material)
  parent.add(object)
  return object
}

export function oval<Material extends T.Material>(parent: T.Object3D, geometry: T.BufferGeometry, material: Material, position: Point, size: Point) {
  const object = mesh(parent, geometry, material)
  object.position.set(...position)
  object.scale.set(...size)
  return object
}

export function curve(points: Point[]) {
  return new T.CatmullRomCurve3(points.map(v))
}

export function tube(parent: T.Object3D, path: T.Curve<T.Vector3>, radius: number, material: T.Material, segments = 48) {
  return mesh(parent, new T.TubeGeometry(path, segments, radius, 8, false), material)
}

export function line(parent: T.Object3D, points: Point[], radius: number, material: T.Material) {
  return tube(parent, curve(points), radius, material, points.length * 10)
}

export function disposeMeshes(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>()
  const materials = new Set<T.Material>()
  root.traverse(object => {
    if (object instanceof T.Mesh || object instanceof T.LineSegments) {
      geometries.add(object.geometry)
      for (const material of [object.material].flat()) materials.add(material)
    }
  })
  geometries.forEach(geometry => geometry.dispose())
  materials.forEach(material => material.dispose())
}
