"""Reproducible NASA Perseverance wheel derivative. Run with Blender -b --python.

Original NASA public-domain model is retained; see ASSETS.md for provenance.
--inspect prints connected-component bounds before any separation.
"""
import bpy
import os
import sys
import bmesh
import math
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'public/models/colony/perseverance.glb'))

def components(mesh):
    parent = list(range(len(mesh.vertices)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for e in mesh.edges:
        a, b = map(find, e.vertices)
        parent[a] = b
    groups = {}
    for v in mesh.vertices:
        groups.setdefault(find(v.index), []).append(v.index)
    return list(groups.values())

if '--inspect' in sys.argv:
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        points = [obj.matrix_world @ v.co for v in obj.data.vertices]
        low = tuple(round(min(p[i] for p in points), 4) for i in range(3))
        high = tuple(round(max(p[i] for p in points), 4) for i in range(3))
        print('MESH', obj.name, len(points), low, high)
        if 'wheel' in obj.name.lower():
            for group in sorted(components(obj.data), key=len, reverse=True)[:35]:
                points = [obj.matrix_world @ obj.data.vertices[i].co for i in group]
                low = tuple(round(min(p[i] for p in points), 4) for i in range(3))
                high = tuple(round(max(p[i] for p in points), 4) for i in range(3))
                print('COMPONENT', len(group), low, high)
    raise SystemExit(0)

source = bpy.data.objects.get('Wheels_objs')
if not source:
    raise RuntimeError('Expected NASA Wheels_objs mesh is missing')
groups = components(source.data)
# Hub positions are recovered from the six largest disconnected tire bounds,
# not invented replacements. Blender source: X axle, -Y forward, Z up.
tires = sorted(groups, key=len, reverse=True)[:6]
hubs = []
for group in tires:
    points = [source.matrix_world @ source.data.vertices[i].co for i in group]
    hubs.append(Vector(tuple((min(p[i] for p in points) + max(p[i] for p in points)) / 2 for i in range(3))))
assignments = {}
for group in groups:
    center = sum((source.matrix_world @ source.data.vertices[i].co for i in group), Vector()) / len(group)
    nearest = min(range(6), key=lambda i: (hubs[i] - center).length_squared)
    assignments.update((i, nearest) for i in group)

for index, hub in enumerate(hubs):
    side = 'L' if hub.x < 0 else 'R'
    row = 'F' if hub.y < -.5 else 'R' if hub.y > .5 else 'M'
    wheel = source.copy()
    wheel.data = source.data.copy()
    bpy.context.collection.objects.link(wheel)
    wheel.name = 'Wheel_' + side + row
    bm = bmesh.new()
    bm.from_mesh(wheel.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if assignments[v.index] != index], context='VERTS')
    bm.to_mesh(wheel.data)
    bm.free()
    # Bake the source transform while preserving all material slots / UVs.
    transform = source.matrix_world.copy()
    wheel.parent = None
    wheel.matrix_world.identity()
    for v in wheel.data.vertices:
        v.co = transform @ v.co - hub
    wheel.location = hub
    wheel.data.update()
    print('SPLIT', wheel.name, 'hub', tuple(hub), 'vertices', len(wheel.data.vertices))
    if len(wheel.data.vertices) < 3000:
        raise RuntimeError('Incomplete wheel: ' + wheel.name)
bpy.data.objects.remove(source, do_unlink=True)

destination = os.path.join(ROOT, 'public/models/colony/perseverance-wheels.glb')
bpy.ops.export_scene.gltf(filepath=destination, export_format='GLB',
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6)
print('EXPORTED', destination, os.path.getsize(destination), 'bytes')

# Asset QA only: articulate four corners after export so the shipped rest pose is neutral.
for obj in bpy.context.scene.objects:
    if obj.name.startswith('Wheel_') and not obj.name.endswith('M'):
        obj.rotation_euler.z = math.radians(25 if obj.name.endswith('F') else -25)
bpy.ops.object.camera_add(location=(4, -5.5, 3.1))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, 1)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 4.8
scene = bpy.context.scene
scene.camera = camera
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.render.resolution_x = 1000
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
os.makedirs(os.path.join(ROOT, 'output'), exist_ok=True)
scene.render.filepath = os.path.join(ROOT, 'output/rover-wheels-qa.png')
bpy.ops.render.render(write_still=True)
