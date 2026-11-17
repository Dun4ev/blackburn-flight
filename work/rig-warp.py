from pathlib import Path
from math import copysign
import bpy
from mathutils import Vector
here=Path(__file__).resolve().parent
scene=bpy.context.scene
holder=bpy.data.objects.new('Wing warping • roll control',None)
coll=next(c for c in scene.collection.children if c.name.startswith('06'))
coll.objects.link(holder);holder.empty_display_type='CIRCLE';holder.empty_display_size=.13
holder['wing_warp']=0.0
holder.id_properties_ui('wing_warp').update(min=-1,max=1,soft_min=-1,soft_max=1,description='Illustrative wing warp. Positive banks right. Controls covering, ribs, spars and wire endpoints.')
layers={'Fabric_Wings','Fabric_WingTapes','Structure_WingSpars','Structure_WingRibs','Rigging_Wires','Rigging_Turnbuckles'}
bind=0
for obj in list(scene.objects):
    if obj.type!='MESH' or obj.get('Web layer') not in layers:continue
    obj.shape_key_add(name='Basis')
    key=obj.shape_key_add(name='Wing warp • roll');key.slider_min=-1;key.slider_max=1
    for i,vert in enumerate(obj.data.vertices):
        x,y,z=obj.matrix_world @ vert.co
        span=min(1,max(0,(abs(x)-.56)/4.30));aft=min(1,max(0,(-y+.67)/1.81))
        key.data[i].co.z+=copysign(.17,x)*span**1.48*aft
    driver=key.driver_add('value').driver;driver.type='AVERAGE'
    var=driver.variables.new();var.name='warp';var.targets[0].id=holder;var.targets[0].data_path='["wing_warp"]'
    bind+=1
assert bind>10
scene['Wing warping']='Collection 06: select Wing warping • roll control and adjust custom property wing_warp from -1 to 1. Deflection is illustrative.'
for img in bpy.data.images:
    if img.source=='FILE' and img.users:
        assert img.packed_file, img.name
        img.filepath='//textures/'+Path(img.filepath).name
assert scene.camera and not scene.camera.hide_render
scene.render.filepath='//Blackburn-Type-D.png'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(here/'Blackburn-finished.blend'),compress=True,relative_remap=False)
mesh=next(o for o in scene.objects if o.get('Web layer')=='Fabric_Wings')
holder['wing_warp']=1.0;holder.update_tag();bpy.context.view_layer.update()
pose=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
offset=max(abs(v.co.z-mesh.data.vertices[i].co.z) for i,v in enumerate(pose.data.vertices))
assert offset>.12,offset
print('WARP VERIFIED',bind,'editable meshes, max observed displacement',offset)
