"""Pack the selected HRA 1.4 brain surfaces into the viewer's glTF asset.

Usage: python3 scripts/prepare-brain.py path/to/3d-allen-f-brain.glb output.glb
Source and license are documented in ANATOMY.md.
"""

import json
from pathlib import Path
from struct import iter_unpack, pack, unpack_from
import sys


def read_glb(path):
    raw = path.read_bytes()
    size = unpack_from("<I", raw, 12)[0]
    return json.loads(raw[20:20 + size]), memoryview(raw)[28 + size:]


class BrainSource:
    def __init__(self, path):
        self.document, self.binary = read_glb(path)

    def accessor(self, index):
        accessor = self.document["accessors"][index]
        view = self.document["bufferViews"][accessor["bufferView"]]
        offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        kind = {5126: "3f", 5125: "I", 5123: "H"}[accessor["componentType"]]
        stride = {"3f": 12, "I": 4, "H": 2}[kind]
        if view.get("byteStride", stride) != stride:
            raise ValueError("Unexpected stride in the source GLB")
        return iter_unpack("<" + kind, self.binary[offset:offset + stride * accessor["count"]])

    def surfaces(self):
        for node in self.document["nodes"]:
            if "mesh" not in node:
                continue
            name = node["name"].removeprefix("Allen_").removesuffix("_L").removesuffix("_R")
            for primitive in self.document["meshes"][node["mesh"]]["primitives"]:
                yield name, (
                    list(self.accessor(primitive["attributes"]["POSITION"])),
                    list(self.accessor(primitive["attributes"]["NORMAL"])),
                    [value for (value,) in self.accessor(primitive["indices"])],
                )


def area(name):
    if name.startswith(("cerebellar_vermis", "paravermis", "lateral_hemisphere_of_cerebellum")):
        return "Cerebellum"
    if name.startswith(("basilar_part_of_pons", "pontine_tegmentum", "pyramidal_part_of_medulla",
                        "tegmentum_of_medulla", "midbrain_tegmentum", "cerebral_peduncle", "inferior_olive")):
        return "Brainstem"
    if name.startswith(("occipital_pole", "cuneus", "lingual_gyrus", "superior_occipital_gyrus", "inferior_occipital_gyrus")):
        return "OccipitalCortex"
    if name.startswith(("primary_motor_cortex", "superior_frontal_gyrus", "middle_frontal_gyrus",
                        "inferior_frontal_gyrus", "gyrus_rectus", "medial_orbital_gyrus", "anterior_intermediate_orbital_gyrus",
                        "posterior_intermediate_orbital_gyrus", "lateral_orbital_gyrus", "paracentral_lobule", "frontal_operculum",
                        "postcentral_gyrus", "supraparietal_lobule", "supramarginal_gyrus", "angular_gyrus", "precuneus",
                        "superior_temporal_gyrus", "middle_temporal_gyrus", "inferior_temporal_gyrus", "occipitotemporal",
                        "lateral_occipitotemporal", "transverse_temporal_gyrus", "planum_", "temporal_pole", "cingulate_gyrus",
                        "subcallosal_gyrus", "parahippocampal_gyrus", "parietal_operculum", "paracingulate_gyrus",
                        "rostral_gyrus", "frontomarginal_gyrus", "frontal_pole", "lateral_olfactory_gyrus",
                        "long_insular_gyri", "short_insular_gyri", "white_matter_of_forebrain")):
        return "Cerebrum"
    return None


def pack_brain(source, destination):
    regions = {}
    for name, (positions, normals, triangles) in source.surfaces():
        key = area(name)
        if not key:
            continue
        # Keep separate batches under the 16-bit index limit.
        batches = regions.setdefault(key, [([], [], [])])
        p, n, indices = batches[-1]
        if len(p) + len(positions) > 65535:
            p, n, indices = [], [], []
            batches.append((p, n, indices))
        indices.extend(len(p) + i for i in triangles)
        p.extend(positions)
        n.extend(normals)

    doc = {
        "asset": {"version": "2.0", "copyright": "Human Reference Atlas and Allen Institute; see ANATOMY.md"},
        "extensionsUsed": ["KHR_mesh_quantization"], "extensionsRequired": ["KHR_mesh_quantization"],
        "scene": 0, "scenes": [{"nodes": []}], "nodes": [], "meshes": [],
        "buffers": [], "bufferViews": [], "accessors": [],
    }
    binary = bytearray()
    brain_positions = [position for batches in regions.values() for positions, _, _ in batches for position in positions]
    top = max(y for _, y, _ in brain_positions)
    posterior = min(z for _, _, z in brain_positions)
    # HRA coordinates are in meters, Y up and anterior along positive Z. Place the atlas within the head.
    def fit(p):
        x, y, z = p
        return ((x + .0076) * 4.18, 2.95 + (y - top) * 4.18, -.398 + (z - posterior) * 4.18)

    def accessor(values, fmt, component, kind, target, stride=None, bounds=False):
        binary.extend(bytes(-len(binary) % 4))
        view = {"buffer": 0, "byteOffset": len(binary), "target": target}
        if stride:
            view["byteStride"] = stride
        for value in values:
            binary.extend(pack(fmt, *value))
        view["byteLength"] = len(binary) - view["byteOffset"]
        doc["bufferViews"].append(view)
        item = {"bufferView": len(doc["bufferViews"]) - 1, "componentType": component, "count": len(values), "type": kind}
        if stride:
            item["normalized"] = True
        if bounds:
            axes = tuple(zip(*values))
            item["min"] = [min(axis) for axis in axes]
            item["max"] = [max(axis) for axis in axes]
        doc["accessors"].append(item)
        return len(doc["accessors"]) - 1

    for name, batches in regions.items():
        for i, (positions, normals, indices) in enumerate(batches):
            attributes = {
                "POSITION": accessor([tuple(round(v * 32767 / 4) for v in fit(p)) for p in positions],
                                     "<3hxx", 5122, "VEC3", 34962, 8, True),
                "NORMAL": accessor([tuple(max(-127, min(127, round(v * 127))) for v in n) for n in normals],
                                   "<3bx", 5120, "VEC3", 34962, 4),
            }
            triangle_accessor = accessor([(index,) for index in indices], "<H", 5123, "SCALAR", 34963)
            doc["scenes"][0]["nodes"].append(len(doc["nodes"]))
            doc["nodes"].append({"name": name + str(i), "mesh": len(doc["meshes"]), "scale": [4, 4, 4]})
            doc["meshes"].append({"primitives": [{"attributes": attributes, "indices": triangle_accessor}]})

    binary.extend(bytes(-len(binary) % 4))
    doc["buffers"].append({"byteLength": len(binary)})
    header = json.dumps(doc, separators=(",", ":")).encode()
    header += b" " * (-len(header) % 4)
    destination.write_bytes(pack("<4sII", b"glTF", 2, 28 + len(header) + len(binary))
                            + pack("<I4s", len(header), b"JSON") + header + pack("<I4s", len(binary), b"BIN\0") + binary)
    print(f"{destination.name}: {destination.stat().st_size:,} bytes")
    for name, batches in regions.items():
        points = [fit(p) for positions, _, _ in batches for p in positions]
        print(name, len(points), [[round(min(axis), 3), round(max(axis), 3)] for axis in zip(*points)])


if __name__ == "__main__":
    pack_brain(BrainSource(Path(sys.argv[1])), Path(sys.argv[2]))
