from pathlib import Path
from math import radians, sin, cos
import bpy
from mathutils import Vector, Matrix
here = Path(__file__).resolve().parent
scene=bpy.context.scene
studio=bpy.data.collections.new('09 • Photographic studio | camera, lights, floor')
scene.collection.children.link(studio)
# Rotate the photographic set around the level airframe. All original modelling axes stay intact.
pitch=radians(8.8)
height=.385+1.08*cos(pitch)-1.04*sin(pitch)
convert=Matrix.Rotation(-pitch,4,'X') @ Matrix.Translation((0,0,-height))
def p(x,y,z):return convert @ Vector((x,y,z))
def track(obj,at):obj.rotation_euler=(at-obj.location).to_track_quat('-Z','Y').to_euler()
def add_area(name, xyz, target, power, size, color):
    light=bpy.data.lights.new(name,'AREA');light.energy=power;light.shape='DISK';light.size=size;light.color=color
    obj=bpy.data.objects.new(name,light);studio.objects.link(obj);obj.location=p(*xyz);track(obj,p(*target));obj.hide_set(True)
add_area('Softbox • sun silk',(-7,3,10),(0,0,1),3400,7,(1,.86,.69))
add_area('Softbox • aluminium edge',(4,7,5),(0,.4,1.2),2500,5,(.76,.87,1))
add_area('Softbox • linen rim',(1,-7,8),(0,-.8,1),3400,5,(1,.85,.67))
add_area('Fill • cockpit',(-7,-6,4),(0,-1,1.2),1050,6,(.71,.83,1))
floor=bpy.data.meshes.new('Seamless floor')
floor.from_pydata([(-120,-120,0),(120,-120,0),(120,120,0),(-120,120,0)],[],[(0,1,2,3)])
ground=bpy.data.objects.new('Cyclorama • parking surface',floor);studio.objects.link(ground)
ground.matrix_world=convert;ground.hide_set(True)
mat=bpy.data.materials.new('Studio • charcoal blue');mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF')
bs.inputs['Base Color'].default_value=(.036,.051,.068,1);bs.inputs['Roughness'].default_value=.86;ground.data.materials.append(mat)
scene.world.use_nodes=True;bg=scene.world.node_tree.nodes.get('Background');bg.inputs['Color'].default_value=(.41,.48,.57,1);bg.inputs['Strength'].default_value=.36
cam=bpy.data.cameras.new('Blackburn • portrait');cam.type='ORTHO';cam.ortho_scale=12.65
camera=bpy.data.objects.new('Camera • Blackburn Type D',cam);studio.objects.link(camera)
camera.location=p(-11.5,8.6,6.0);look=p(0,-1.05,1.29);track(camera,look);scene.camera=camera;camera.hide_set(True)
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=1560;scene.render.resolution_y=925;scene.render.resolution_percentage=100
scene.render.film_transparent=False;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
scene.view_settings.view_transform='AgX';scene.render.filepath='//Blackburn-Type-D.png'
scene.render.image_settings.color_depth='8'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(here/'Blackburn-studio.blend'),compress=True)
scene.render.filepath=str(here/'Blackburn-preview.png')
bpy.ops.render.render(write_still=True)
print('PREVIEW_RENDERED',scene.render.filepath)
