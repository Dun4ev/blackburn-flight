"""Meter-scale geometry primitives for an editable collection-based drawing."""
import math
from collections import defaultdict
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

work = Path(__file__).resolve().parent
outputs = work.parent / 'outputs'
materials = {}
parts = []
sections = {}
pi = math.pi
tau = 2 * pi
sin, cos, sqrt = math.sin, math.cos, math.sqrt


def linear(c):
    c /= 255.0
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4


def surface(name, rgb, metal=0, rough=.55, texture=None):
    mat = bpy.data.materials.new(name)
    color = tuple(linear(v) for v in rgb) + (1,)
    mat.diffuse_color = color
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get('Principled BSDF')
    for key, val in [('Base Color', color), ('Metallic', metal), ('Roughness', rough)]:
        principled.inputs[key].default_value = val
    if texture:
        N = 256
        vy, vx = np.indices((N, N))
        x, y = vx / N, vy / N
        rng = np.random.default_rng(164)
        if texture == 'linen':
            weave = .011 * np.cos(tau * 70 * x + .25 * np.sin(tau * 3 * y)) + .014 * np.cos(tau * 69 * y)
            variation = weave + .010 * np.sin(tau * (2*x+y)) + .007 * np.sin(tau*(x-2*y)) + rng.normal(0,.004,(N,N))
        else:
            run = 12*y + .45*np.sin(tau*x) + .1*np.sin(tau*(2*x+y))
            variation = .065*np.cos(tau*run) + .031*np.cos(tau*(2*run+2*y)) + .032*np.sin(tau*(4*y+x)) + rng.normal(0,.008,(N,N))
        data = np.ones((N,N,4), dtype=np.float32)
        for ch in range(3):
            data[:,:,ch] = np.clip((rgb[ch] / 255.) * (1 + variation), 0, 1)
        img = bpy.data.images.new(name + ' • woven or sawn surface', width=N, height=N, alpha=False)
        # An image generated in Blender accepts linear values and writes them to sRGB PNG;
        # assign the RNA byte buffer directly in linear-light coordinates.
        data[:,:,:3] = np.where(data[:,:,:3] <= .04045, data[:,:,:3]/12.92, ((data[:,:,:3]+.055)/1.055)**2.4)
        # The byte image float pixel API maps through its declared color space.
        # Make a true byte-accurate color tile with the standard-library PNG encoder.
        import struct,zlib
        encoded = np.where(data[:,:,:3] <= .0031308, 12.92*data[:,:,:3], 1.055*data[:,:,:3]**(1/2.4)-.055)
        rgbbytes=(np.clip(encoded,0,1)*255+.5).astype(np.uint8)
        def chunk(label, content):
            return struct.pack('>I',len(content))+label+content+struct.pack('>I',zlib.crc32(label+content)&0xffffffff)
        raw=b''.join(b'\x00'+row.tobytes() for row in rgbbytes)
        tile=work/('aircraft_tex_'+texture+'_'+str(rgb[0])+'.png')
        tile.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>2I5B',N,N,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))
        bpy.data.images.remove(img)
        img=bpy.data.images.load(str(tile))
        img.name = name + ' • tile'
        img.pack()
        tex=mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image=img
        mat.node_tree.links.new(tex.outputs['Color'],principled.inputs['Base Color'])
        principled.inputs['Base Color'].default_value=(1,1,1,1)
    materials[name] = mat
    return name


class Part:
    def __init__(self, name, category, export, material, origin=(0,0,0)):
        self.name, self.category, self.export = name, category, export
        self.material = material
        self.origin = Vector(origin)
        self.v, self.f, self.fm, self.sm, self.uv = [], [], [], [], []
        parts.append(self)

    def mesh(self, vertices, faces, smooth=False, mat=None, uv=None):
        index = len(self.v)
        self.v.extend(tuple(p) for p in vertices)
        self.uv.extend(uv if uv is not None else [(0,0)]*len(vertices))
        self.f.extend(tuple(index+i for i in face) for face in faces)
        self.sm.extend([smooth]*len(faces))
        self.fm.extend([mat or self.material]*len(faces))

    def object(self, collection, name=None):
        me = bpy.data.meshes.new(name or self.name)
        org=self.origin
        me.from_pydata([(p[0]-org.x,p[1]-org.y,p[2]-org.z) for p in self.v],[],self.f)
        slots={m:i for i,m in enumerate(dict.fromkeys(self.fm))}
        for m in slots: me.materials.append(materials[m])
        me.polygons.foreach_set('material_index',[slots[m] for m in self.fm])
        me.polygons.foreach_set('use_smooth',self.sm)
        uvs=me.uv_layers.new(name='Surface coordinates')
        ids=np.zeros(len(me.loops),dtype=np.int32)
        me.loops.foreach_get('vertex_index',ids)
        uvs.data.foreach_set('uv',np.asarray(self.uv,dtype=np.float32)[ids].ravel())
        me.update()
        obj=bpy.data.objects.new(name or self.name,me)
        collection.objects.link(obj)
        obj.location=org
        return obj

    def merge(self, other):
        idx=len(self.v)
        self.v.extend(other.v); self.uv.extend(other.uv)
        self.f.extend(tuple(idx+i for i in face) for face in other.f)
        self.sm.extend(other.sm); self.fm.extend(other.fm)


def pipe(part, path, radius, sides=8, material=None, flat=False):
    path=[Vector(p) for p in path]
    if isinstance(radius,(int,float)): radius=[radius]*len(path)
    vec=(path[-1]-path[0]).normalized()
    if vec.length<.5: vec=(path[1]-path[0]).normalized()
    axis=Vector((1,0,0)) if abs(vec.x)<.8 else Vector((0,1,0))
    verts=[]; uvs=[]; faces=[]; length=0
    for i,p in enumerate(path):
        v=(path[min(i+1,len(path)-1)]-path[max(0,i-1)]).normalized()
        if i: length+=(p-path[i-1]).length
        v1=(axis-v*axis.dot(v)).normalized()
        if v1.length<.3: v1=v.cross(Vector((0,0,1))).normalized()
        v2=v.cross(v1)
        for j in range(sides):
            a=tau*j/sides
            verts.append(p+radius[i]*(v1*cos(a)+v2*sin(a)))
            uvs.append((length*1.8,j/sides))
        if i:
            for j in range(sides):
                a=(i-1)*sides+j; b=(i-1)*sides+(j+1)%sides
                faces.append((a,b,b+sides,a+sides))
    faces.extend([tuple(reversed(range(sides))),tuple(range(len(verts)-sides,len(verts)))])
    part.mesh(verts,faces,not flat,material,uvs)


def rod(p, a, b, radius, sides=8, material=None):
    pipe(p,[a,b],radius,sides,material)


def strut(p,a,b,w,d=None,material=None):
    a,b=Vector(a),Vector(b)
    delta=b-a
    axis=delta.normalized()
    ref=Vector((0,1,0)) if abs(axis.y)<.89 else Vector((1,0,0))
    along=(ref-axis*ref.dot(axis)).normalized()
    across=axis.cross(along)
    d=w if d is None else d
    vs=[];us=[]
    for t,f in [(0,.73),(.07,1),(.93,1),(1,.73)]:
        for j in range(8):
            ang=tau*(j+.5)/8
            x=math.copysign(abs(cos(ang))**.52,cos(ang))
            y=math.copysign(abs(sin(ang))**.52,sin(ang))
            vs.append(a+delta*t+along*x*w*f+across*y*d*f)
            us.append((t*delta.length*1.6,j/8))
    faces=[(i*8+j,i*8+(j+1)%8,(i+1)*8+(j+1)%8,(i+1)*8+j) for i in range(3) for j in range(8)]
    faces +=[tuple(reversed(range(8))),tuple(range(24,32))]
    p.mesh(vs,faces,True,material,us)


def ellipsoid(p,center,radii,mat=None,nu=16,nv=8):
    vs=[];uv=[]
    cx,cy,cz=center;rx,ry,rz=radii
    for i in range(nv+1):
        a=pi*(i+.001)/(nv+.002)-pi/2
        for j in range(nu):
            b=tau*j/nu
            vs.append((cx+rx*cos(a)*cos(b),cy+ry*cos(a)*sin(b),cz+rz*sin(a)))
            uv.append((j/nu,i/nv))
    fs=[(i*nu+j,i*nu+(j+1)%nu,(i+1)*nu+(j+1)%nu,(i+1)*nu+j) for i in range(nv) for j in range(nu)]
    p.mesh(vs,fs,True,mat,uv)


def torus(p,center,axis,major,minor,major_steps=48,minor_steps=8,mat=None):
    c=Vector(center); a=Vector(axis).normalized()
    ref=Vector((0,0,1)) if abs(a.z)<.9 else Vector((1,0,0))
    e=a.cross(ref).normalized(); f=a.cross(e)
    vs=[]; us=[]
    for i in range(major_steps):
        u=tau*i/major_steps; radial=e*cos(u)+f*sin(u)
        for j in range(minor_steps):
            v=tau*j/minor_steps
            vs.append(c+radial*(major+minor*cos(v))+a*(minor*sin(v)));us.append((2*i/major_steps,j/minor_steps))
    fs=[]
    for i in range(major_steps):
        k=(i+1)%major_steps
        for j in range(minor_steps):
            m=(j+1)%minor_steps
            fs.append((i*minor_steps+j,k*minor_steps+j,k*minor_steps+m,i*minor_steps+m))
    p.mesh(vs,fs,True,mat,us)


def ribbon(p, path, offset, mat=None):
    vs=[]; uv=[]
    for i,pt in enumerate(path):
        v=Vector(pt);off=Vector(offset)
        vs.extend((v-off,v+off)); uv.extend(((0,i*.12),(1,i*.12)))
    fs=[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(path)-1)]
    p.mesh(vs,fs,True,mat,uv)


def lathe_y(p, contour, theta_limits=(0,tau), segments=64, mat=None):
    """Contour elements are (y, horizontal radius, z center, vertical radius)."""
    verts=[];uv=[];fs=[]
    for i,(y,rx,zc,rz) in enumerate(contour):
        for j in range(segments+1):
            a=theta_limits[0]+(theta_limits[1]-theta_limits[0])*j/segments
            verts.append((rx*sin(a),y,zc+rz*cos(a))); uv.append((y*1.7,j/segments))
        if i:
            for j in range(segments):
                k=(i-1)*(segments+1)+j
                fs.append((k,k+segments+1,k+segments+2,k+1))
    p.mesh(verts,fs,True,mat,uv)


def interpolate(x,pairs):
    if x<=pairs[0][0]: return pairs[0][1]
    for (a,v),(b,w) in zip(pairs,pairs[1:]):
        if x<=b: return v+(w-v)*(x-a)/(b-a)
    return pairs[-1][1]
