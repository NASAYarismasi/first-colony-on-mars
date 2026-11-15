"""Bake a rigid, unrigged NASA suit into a seated pose (Blender CLI)."""
import bpy
import math
import os
from mathutils import Vector, Matrix

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath='public/assets/astronaut.glb')
objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
points = [o.matrix_world @ v.co for o in objects for v in o.data.vertices]
lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
scale = 1.85 / (hi.z-lo.z)
for o in objects:
    transform = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = Matrix.Identity(4)
    for v in o.data.vertices:
        p = transform @ v.co
        v.co = Vector(((p.x-(lo.x+hi.x)/2)*scale, (p.y-(lo.y+hi.y)/2)*scale, (p.z-lo.z)*scale))

def smooth(start, end, value):
    t = max(0, min(1, (value-start)/(end-start)))
    return t*t*(3-2*t)

# Optional diagnostic view, before baking.
import sys
inspect = '--inspect' in sys.argv
if not inspect:
    # Blend rotations across the cuffs, knees and hips to preserve continuous suit surfaces.
    recline = Matrix.Rotation(math.radians(-24), 3, 'X')
    torso_pivot = Vector((0, 0, .91))
    shoulders = {side: Matrix.Rotation(side*math.radians(78), 3, 'Y') for side in (-1, 1)}
    hip_rotation = Matrix.Rotation(math.radians(-88), 3, 'X')
    for o in objects:
        for v in o.data.vertices:
            point = v.co.copy()
            x = abs(point.x)
            side = 1 if point.x > 0 else -1
            shoulder_weight = smooth(.195, .355, x)*smooth(1.15, 1.30, point.z)*(1-smooth(-.035, .025, point.y))
            distal_weight = smooth(.325, .40, x)*smooth(1.12, 1.20, point.z)
            arm_weight = shoulder_weight*(1-distal_weight)+distal_weight
            leg_weight = (1-smooth(.85, 1.0, point.z))*(1-smooth(.098, .145, point.y))
            if arm_weight:
                shoulder = Vector((side*.237, -.085, 1.38))
                upper_arm = shoulders[side]
                elbow = shoulder+upper_arm@(Vector((side*.49, -.085, 1.36))-shoulder)
                lowered = shoulder+upper_arm@(point-shoulder)
                elbow_rotation = Matrix.Rotation(math.radians(-65)*smooth(.43, .58, x), 3, 'X')
                posed = elbow+elbow_rotation@(lowered-elbow)
                point = point.lerp(posed, arm_weight)
            if leg_weight:
                hip = Vector((point.x, 0, .91))
                knee = Vector((point.x, 0, .46))
                knee_rotation = Matrix.Rotation(math.radians(88)*(1-smooth(.36,.56,point.z)), 3, 'X')
                bent = knee+knee_rotation@(point-knee)
                point = point.lerp(hip+hip_rotation@(bent-hip), leg_weight)
            v.co = torso_pivot+recline@(point-torso_pivot)
        o.data.update()
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath('public/assets/astronaut-seated.glb'), export_format='GLB', use_selection=True)

# Orthographic asset QA: front three-quarter view.
bpy.ops.object.camera_add(location=(2.8,-4.5,2.5))
camera = bpy.context.object
camera.rotation_euler = (Vector((0,0,.95))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'
camera.data.ortho_scale=2.6
bpy.context.scene.camera=camera
scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO'
scene.display.shading.color_type='MATERIAL'
scene.display.shading.show_shadows=True
scene.display.shading.show_cavity=True
scene.render.resolution_x=700
scene.render.resolution_y=700
scene.render.resolution_percentage=100
os.makedirs('output', exist_ok=True)
scene.render.filepath=os.path.abspath('output/crew-original.png' if inspect else 'output/crew-seated.png')
bpy.ops.render.render(write_still=True)
