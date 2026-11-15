"""Rig the published NASA astronaut mesh and render its gloves for KERK."""
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath='public/assets/astronaut.glb')
suit = next(obj for obj in bpy.context.scene.objects if obj.type == 'MESH')
points = [suit.matrix_world @ vertex.co for vertex in suit.data.vertices]
low, high = (Vector(tuple(edge(p[i] for p in points) for i in range(3))) for edge in (min, max))
scale = 1.85 / (high.z - low.z)
suit.parent = None
suit.matrix_world = Matrix.Identity(4)
for vertex, point in zip(suit.data.vertices, points):
    vertex.co = ((point.x - (low.x + high.x)/2)*scale,
                 (point.y - (low.y + high.y)/2)*scale, (point.z - low.z)*scale)

# Keep the original textured mesh for the glove render before posing the shoulders.
glove_source = suit.data.copy()

def smooth(start, end, value):
    t = max(0, min(1, (value - start)/(end - start)))
    return t*t*(3 - 2*t)

armature = bpy.data.armatures.new('EVA suit rig')
rig = bpy.data.objects.new('EVA suit rig', armature)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
pivots = {'body': (0, 0, 0), 'armL': (.237, -.085, 1.38), 'armR': (-.237, -.085, 1.38),
          'legL': (.112, -.03, .92), 'legR': (-.112, -.03, .92)}
for label, pivot in pivots.items():
    bone = armature.edit_bones.new('Walk_' + label)
    bone.head = pivot
    bone.tail = Vector(pivot) + Vector((0, 0, .24))
    if label != 'body':
        bone.parent = armature.edit_bones['Walk_body']
bpy.ops.object.mode_set(mode='OBJECT')
groups = {part: suit.vertex_groups.new(name='Walk_' + part) for part in pivots}
rotations = {side: Matrix.Rotation(side*math.radians(73), 3, 'Y') for side in (1, -1)}
for vertex in suit.data.vertices:
    point = vertex.co.copy()
    side = 1 if point.x >= 0 else -1
    x = abs(point.x)
    shoulder_weight = smooth(.195, .355, x) * smooth(1.15, 1.30, point.z) * (1-smooth(-.035, .025, point.y))
    distal_weight = smooth(.325, .40, x)*smooth(1.12, 1.20, point.z)
    arm = shoulder_weight*(1-distal_weight) + distal_weight
    arm_key = 'armL' if side == 1 else 'armR'
    if arm:
        shoulder = Vector(pivots[arm_key])
        standing = shoulder + rotations[side] @ (point - shoulder)
        vertex.co = point.lerp(standing, arm)
        groups[arm_key].add([vertex.index], arm, 'REPLACE')
    leg = (1-smooth(.85, 1.00, point.z)) * (1-arm) * (1-smooth(.098, .145, point.y))
    left = smooth(-.032, .032, point.x)
    if leg*left: groups['legL'].add([vertex.index], leg*left, 'REPLACE')
    if leg*(1-left): groups['legR'].add([vertex.index], leg*(1-left), 'REPLACE')
    groups['body'].add([vertex.index], max(0, 1-arm-leg), 'REPLACE')

suit.parent = rig
skin = suit.modifiers.new('Continuous suit skin', 'ARMATURE')
skin.object = rig
suit.data.update()
bpy.ops.object.select_all(action='DESELECT')
suit.select_set(True)
rig.select_set(True)
bpy.ops.export_scene.gltf(filepath='public/models/colony/team-astronaut-walk.glb',
                         export_format='GLB', use_selection=True, export_animations=False)

# Orthographic artwork matching the 900 × 620 DOM tablet layout. The pair is derived from
# the actual distal sleeve/hand geometry. The left and right hands share the source topology.
bpy.data.objects.remove(suit, do_unlink=True)
bpy.data.objects.remove(rig, do_unlink=True)
scene = bpy.context.scene
seal = bpy.data.materials.new('Wrist disconnect ring')
seal.diffuse_color = (.19, .22, .25, 1)
seal.use_nodes = True
shader = seal.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value = seal.diffuse_color
shader.inputs['Metallic'].default_value = .45
shader.inputs['Roughness'].default_value = .48
for direction in (-1, 1):
    mesh = glove_source.copy()
    bm = bmesh.new()
    mesh.materials.append(seal)
    bm.from_mesh(mesh)
    bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
                           dist=.00001, plane_co=(.51, 0, 0), plane_no=(1, 0, 0), clear_inner=True)
    for edge_x in (.673, .688):
        bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
                               dist=.00001, plane_co=(edge_x, 0, 0), plane_no=(1, 0, 0))
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00012)
    for face in bm.faces:
        face.smooth = True
        if .673 < face.calc_center_median().x < .688:
            face.material_index = len(mesh.materials)-1
    for vertex in bm.verts:
        x, y, z = vertex.co
        # Wrap the fingers gently toward the grip, keeping each NASA mesh vertex and its UVs.
        bend = smooth(.755, .86, x)
        along = x-.51-.024*bend
        cross = y+.10
        depth = z-1.33-.045*bend
        side_x = 31+along*345-cross*780
        pixel_x = side_x if direction == -1 else 900-side_x
        pixel_y = 654-along*840-cross*255
        vertex.co = ((pixel_x-450)/900, (310-pixel_y)/900, depth)
    if direction == 1:
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    glove = bpy.data.objects.new('EVA glove',mesh)
    scene.collection.objects.link(glove)

bpy.ops.object.camera_add(location=(0, 0, 3))
camera = bpy.context.object
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 1
scene.camera = camera

def area(position, energy, size, target):
    bpy.ops.object.light_add(type='AREA', location=position)
    lamp = bpy.context.object
    lamp.data.energy = energy
    lamp.data.size = size
    lamp.rotation_euler = (Vector(target)-lamp.location).to_track_quat('-Z','Y').to_euler()

area((-.75, .65, 1.55), 76, .78, (0, -.15, 0))
area((.8, -.12, 1.25), 38, .68, (0, -.19, 0))
area((0, -.8, .55), 17, .5, (0, -.2, 0))
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x, scene.render.resolution_y = 900, 620
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = str(Path('public/art/eva-gloves.png').resolve())
bpy.ops.render.render(write_still=True)
