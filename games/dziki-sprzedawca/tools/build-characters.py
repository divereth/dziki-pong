"""Convert Quaternius' CC0 Blender sources to lightweight animated market NPCs.

Run in Blender with -- <source-directory> <output-directory>.
Sources: https://quaternius.com/packs/ultimatedanimatedcharacter
"""
import bpy, sys, math, json
from pathlib import Path

args = sys.argv[sys.argv.index('--') + 1:]
source, output = map(Path, args[:2])
selected = set(args[2].split(',')) if len(args) > 2 else None
output.mkdir(parents=True, exist_ok=True)
models = {
    'casual-man': 'Casual_Male', 'casual-woman': 'Casual_Female',
    'jacket-man': 'Casual2_Male', 'jacket-woman': 'Casual2_Female',
    'sport-man': 'Casual3_Male', 'sport-woman': 'Casual3_Female',
    'worker-man': 'Worker_Male', 'worker-woman': 'Worker_Female',
    'chef-man': 'Chef_Male', 'chef-woman': 'Chef_Female',
    'older-man': 'OldClassy_Male', 'older-woman': 'OldClassy_Female',
    'police': 'Casual_Male', 'guard': 'Casual_Bald',
}

def solid_material(name, color):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    return material

skin_tones = [( .68, .39, .22), (.84, .57, .36), (.33, .16, .085),
              (.50, .27, .14), (.94, .72, .50), (.21, .085, .043)]

for model_index, (name, original) in enumerate(models.items()):
    if selected and name not in selected:
        continue
    bpy.ops.wm.open_mainfile(filepath=str(source / (original + '.blend')))
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    scene = bpy.context.scene
    arm = next(o for o in scene.objects if o.type == 'ARMATURE')
    body = next(o for o in scene.objects if o.type == 'MESH')
    arm.animation_data_clear()
    arm.animation_data_create()
    actions = []
    for action in list(bpy.data.actions):
        if action.name not in ['Idle', 'Walk']:
            bpy.data.actions.remove(action)
        else:
            action.name = action.name.lower()
            actions.append(action)
    idle = next(a for a in actions if a.name == 'idle')
    arm.animation_data.action = idle
    if idle.slots:
        arm.animation_data.action_slot = idle.slots[0]
    scene.frame_set(0)
    # Accessories are authored in the source rest coordinates, then skinned
    # with the same rig. Joining them keeps each finished NPC to one draw call.
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    additions = []
    for material in body.data.materials:
        if material.name == 'Skin':
            material.diffuse_color = (*skin_tones[model_index % len(skin_tones)], 1)
    if name == 'police':
        colors = {'Shirt': (.008, .02, .05), 'Pants': (.006, .012, .026),
                  'Belt': (.012, .016, .02), 'Hair': (.07, .042, .025)}
        for material in body.data.materials:
            if material.name in colors:
                material.diffuse_color = (*colors[material.name], 1)
        navy = solid_material('PoliceCap', (.008, .018, .045))
        gold = solid_material('PoliceBadge', (.85, .63, .18))
        white = solid_material('PoliceLettering', (.83, .9, 1))

        def rig_part(obj, bone, material):
            obj.data.materials.append(material)
            obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
            mod = obj.modifiers.new('CharacterRig', 'ARMATURE')
            mod.object = arm
            additions.append(obj)

        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=.53, depth=.25, location=(0, -.012, 3.24))
        rig_part(bpy.context.object, 'Head', navy)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -.46, 3.09))
        cap = bpy.context.object
        cap.scale = (.88, .38, .045)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        rig_part(cap, 'Head', navy)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=4, radius=.065, location=(0, -.54, 3.24))
        cap_badge = bpy.context.object
        cap_badge.scale = (.7, .18, 1)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        rig_part(cap_badge, 'Head', gold)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=4, radius=.065, location=(-.2, -.275, 1.85))
        badge = bpy.context.object
        badge.scale = (.7, .18, 1)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        rig_part(badge, 'Torso', gold)
        bpy.ops.object.text_add(location=(-.22, -.298, 1.67), rotation=(math.pi/2, 0, 0))
        text = bpy.context.object
        text.data.body = 'POLICJA'
        text.data.size = .095
        text.data.extrude = 0
        bpy.ops.object.convert(target='MESH')
        rig_part(bpy.context.object, 'Torso', white)
    elif name == 'guard':
        for material in body.data.materials:
            if material.name in ['Shirt', 'Pants']:
                material.diffuse_color = ((.018, .023, .03, 1) if material.name == 'Shirt' else (.04, .045, .055, 1))
        # Thicken the torso and arm cross-sections without widening the head
        # or moving the rig's shoulder and elbow joints.
        for vertex in body.data.vertices:
            if not vertex.groups:
                continue
            group = max(vertex.groups, key=lambda g:g.weight)
            bone_name = body.vertex_groups[group.group].name
            if bone_name in ['Torso', 'Abdomen', 'Hips']:
                vertex.co.x *= 1.45
                vertex.co.y *= 1.3
            elif bone_name.startswith(('UpperArm', 'LowerArm')):
                bone = arm.data.bones[bone_name]
                factor = 1.6 if bone_name.startswith('UpperArm') else 1.3
                vertex.co.y = bone.head_local.y + (vertex.co.y - bone.head_local.y) * factor
                vertex.co.z = bone.head_local.z + (vertex.co.z - bone.head_local.z) * factor

    # The original assets use flat colour materials. Bake those colours to
    # vertices so no texture downloads or six-material draw calls are needed.
    material = bpy.data.materials.new('MarketCharacterColors')
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = .86
    color_node = material.node_tree.nodes.new('ShaderNodeVertexColor')
    color_node.layer_name = 'CharacterColors'
    material.node_tree.links.new(color_node.outputs['Color'], shader.inputs['Base Color'])
    parts = [body] + additions
    for part in parts:
        mesh = part.data
        colors = mesh.color_attributes.new(name='CharacterColors', type='FLOAT_COLOR', domain='CORNER')
        mesh.color_attributes.active_color = colors
        for polygon in mesh.polygons:
            color = mesh.materials[polygon.material_index].diffuse_color
            for loop in polygon.loop_indices:
                vertex_color = color
                vertex = mesh.vertices[mesh.loops[loop].vertex_index]
                if name == 'police' and part == body and mesh.materials[polygon.material_index].name == 'Skin' and vertex.co.z < .95:
                    vertex_color = (.006, .012, .026, 1) if vertex.co.z > .17 else (.008, .009, .012, 1)
                colors.data[loop].color = vertex_color
            polygon.material_index = 0
            polygon.use_smooth = False
        mesh.materials.clear()
        mesh.materials.append(material)
        for uv in list(mesh.uv_layers):
            mesh.uv_layers.remove(uv)
    bpy.ops.object.select_all(action='DESELECT')
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body.name = name
    arm.data.pose_position = 'POSE'
    arm.name = 'CharacterRig'
    for mod in list(body.modifiers):
        if mod.type != 'ARMATURE':
            body.modifiers.remove(mod)
    scene.render.fps = 30
    scene.frame_set(0)
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(
        filepath=str(output / (name + '.glb')), export_format='GLB',
        use_selection=True, export_yup=True, export_animations=True,
        export_animation_mode='ACTIONS', export_frame_range=False,
        export_force_sampling=True, export_optimize_animation_size=True,
        export_skins=True, export_vertex_color='ACTIVE',
        export_all_vertex_colors=True, export_extras=False,
    )
    print('CHARACTER_EXPORTED', name, flush=True)
