"""Blackburn Type D (G-AANI), interpretive reconstruction in SI units."""
import sys, math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from model_geometry import *
from mathutils import Quaternion, Euler

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
linen=surface('Linen | clear dope, upper', (235,216,164),rough=.78,texture='linen')
under=surface('Linen | shaded lower surface', (220,201,151),rough=.79,texture='linen')
tape=surface('Linen | rib finishing tape',(232,210,153),rough=.81)
seam=surface('Linen | spar and hem shadow',(192,168,116),rough=.8)
ash=surface('Timber | varnished ash',(169,109,56),rough=.4,texture='ash')
spruce=surface('Timber | pale spar spruce',(198,151,88),rough=.52,texture='spruce')
walnut=surface('Timber | laminated propeller',(130,67,37),rough=.32,texture='walnut')
lamella=surface('Timber | darker laminations',(100,49,31),rough=.35)
leather=surface('Leather | brown seat & coaming',(75,42,29),rough=.68)
metal=surface('Alloy | rolled aluminium',(178,183,184),.71,.32)
rolled=surface('Alloy | silver panel edging',(193,196,193),.7,.29)
gun=surface('Steel | gunmetal',(53,61,65),.68,.38)
iron=surface('Steel | black enamel',(39,43,43),.39,.42)
brass=surface('Brass | tarnished hardware',(173,132,69),.64,.33)
wire=surface('Steel | rigging wire',(84,86,81),.50,.41)
rubber=surface('Rubber | unpigmented tyres',(164,154,134),.04,.85)
ebonite=surface('Ebonite & dial faces',(34,33,31),0,.45)
porcelain=surface('Enamel | dial markings',(228,220,190),.06,.55)
secW='01  •  Wings and flying surfaces'; secFrame='02  •  Timber skeleton'
secF='03  •  Fuselage'; secC='04  •  Cockpit'; secP='05  •  Gnôme Omega and airscrew'
secR='06  •  Lift, landing and control wires'; secG='07  •  Undercarriage'; secT='08  •  Empennage'
def part(name,section,ex,ma,origin=(0,0,0)):return Part(name,section,ex,ma,origin)

# The representative preserved aircraft has warped wings, with a continuous trailing edge.
half=9.7155/2; root=.345
rib_positions=[root,.69,1.055,1.42,1.785,2.15,2.515,2.88,3.245,3.61,3.975,4.335,4.63,half]
def wing_coords(x,t,top=1,sag=False):
    a=abs(x); span=(a-root)/(half-root)
    radius=.32
    roundtip=radius-sqrt(max(0,radius**2-max(0,a-(half-radius))**2))
    leading=1.16-.145*span-.97*roundtip
    trailing=-1.045-.11*span+1.10*roundtip
    chord=leading-trailing
    arc=.084*math.sin(pi*t)**.82+.043*(1-t)
    thickness=chord*.075*5*(.2969*sqrt(max(t,0))-.126*t-.3516*t*t+.2843*t**3-.1036*t**4)
    base=.04+.088*span**1.35+.012*span*t
    depression=0
    if sag:
        for xa,xb in zip(rib_positions,rib_positions[1:]):
            if xa<=a<=xb:
                depression=sin(pi*(a-xa)/(xb-xa))**2*sin(pi*t)**.68
                break
    return (x,leading-t*chord,base+arc+top*thickness-depression*(.009 if top==1 else -.005))
chords=[0,.008,.022,.048,.08,.13,.19,.26,.34,.42,.50,.58,.66,.74,.82,.89,.95,.982,1]
for s,side in [(-1,'L'),(1,'R')]:
    surf=part('Outer covering • '+side,secW,'Fabric_Wings',linen)
    for face in (1,-1):
        vs=[];uv=[];fs=[]
        xs=[a+(b-a)*k/4 for a,b in zip(rib_positions,rib_positions[1:]) for k in range(4)]+[half]
        for a in xs:
            for t in chords:
                pp=wing_coords(s*a,t,face,True);vs.append(pp);uv.append((a*2.1,pp[1]*2.1))
        nc=len(chords)
        for i in range(len(xs)-1):
            for j in range(nc-1):
                k=i*nc+j
                f=(k,k+nc,k+nc+1,k+1)
                fs.append(f if face*s<0 else f[::-1])
        surf.mesh(vs,fs,True,linen if face==1 else under,uv)
    # Closure at square-ended tip, and an edge binding sewn round it.
    for a in (root,half):
        vs=[wing_coords(s*a,t,face) for face in [1,-1] for t in chords]
        nc=len(chords)
        fs=[(j,j+1,nc+j+1,nc+j) for j in range(nc-1)]
        surf.mesh(vs,fs,True,linen,[(p[1]*2,p[2]*2) for p in vs])
    bands=part('Rib and perimeter tapes • '+side,secW,'Fabric_WingTapes',tape)
    for a in rib_positions[1:-1]:
        for face in [1,-1]:
            points=[tuple(Vector(wing_coords(s*a,t,face))+Vector((0,0,.0026*face))) for t in chords]
            ribbon(bands,points,(.010,0,0),tape if face>0 else seam)
    # Sawn full-section rib outlines, webs, spars, and tip bows are individually editable.
    for i,a in enumerate(rib_positions):
        r=part(f'{side} • Form rib {i+1:02}',secFrame,'Structure_WingRibs',spruce)
        a=min(a,half-.025)
        for face in (1,-1):
            pth=[tuple(Vector(wing_coords(s*a,.019+.945*t,face))+Vector((0,0,-.010*face))) for t in chords]
            pipe(r,pth,.010,6)
        for t1,t2 in [(0.11,.27),(.28,.48),(.49,.70),(.71,.86)]:
            b=wing_coords(s*a,t1,-1);c=wing_coords(s*a,t2,1)
            strut(r,b,c,.008,.008)
    spar=part('Two main spars and trailing bow • '+side,secFrame,'Structure_WingSpars',ash)
    for t in [.005,.23,.65,.948]:
        pts=[]
        for a in rib_positions:
            a=min(a,half-.021)
            p1=Vector(wing_coords(s*a,t,1));p2=Vector(wing_coords(s*a,t,-1))
            pts.append((p1+p2)*.5)
        if t in [.005,.948]:
            pipe(spar,pts,.009 if t==.005 else .007,8)
        else:
            for a,b in zip(pts,pts[1:]): strut(spar,a,b,.018,.023)
    # Shallow shadows of spars showing through the lower linen, as in the museum's flight photograph.
    for t in (.23,.65):
        pp=[tuple(Vector(wing_coords(s*a,t,-1))+Vector((0,0,-.002))) for a in xs]
        ribbon(bands,pp,(0,.008,0),seam)

# Triangular ash girder: shoulders form a broad top, converging below at a keel.
fuselage_profiles=[(-5.36,.047,.19,.055),(-4.75,.093,.195,-.015),(-4.12,.144,.211,-.11),(-3.43,.191,.225,-.211),(-2.67,.242,.245,-.328),(-1.93,.299,.268,-.444),(-1.26,.349,.29,-.547),(-.84,.373,.299,-.605),(-.36,.405,.312,-.666),(.31,.418,.323,-.69),(1.0,.426,.332,-.668),(1.44,.415,.331,-.525)]
def profile(y):
    return tuple(interpolate(y,[(a,f[i]) for f in fuselage_profiles for a in [f[0]]]) for i in (1,2,3))
def station(y):
    w,zt,zb=profile(y)
    if y>=-.84:
        w*=.76;zt-=.104;zb+=.05
    return [Vector((-w,y,zt)),Vector((w,y,zt)),Vector((0,y,zb))]
frame=part('Ash longerons, keel and triangular stations',secFrame,'Structure_Fuselage',ash)
braces=part('Diagonal side members and ties',secFrame,'Structure_Fuselage',spruce)
y_stations=[p[0] for p in fuselage_profiles]
for ya,yb in zip(y_stations,y_stations[1:]):
    a,b=station(ya),station(yb)
    for i in range(3):
        strut(frame,a[i],b[i],.022,.025)
        strut(frame,a[i],a[(i+1)%3],.014,.018)
    for i in (0,1):
        strut(braces,a[i],b[2],.012,.013)
    rod(braces,a[0],b[1],.005,5,wire)
# Full fabric skin behind the cockpit. Faceted triangle retains the narrow hull shape.
skin=part('Doped fabric on rear fuselage',secF,'Fabric_Fuselage',linen)
tapes=part('Girder and seam shadows',secF,'Fabric_FuselageTapes',tape)
for ya,yb in zip(y_stations,y_stations[1:]):
    if ya>=-.84: break
    def outer_station(y):
        w,zt,zb=profile(y)
        return [Vector((-w,y,zt)),Vector((w,y,zt)),Vector((0,y,zb))]
    a,b=outer_station(ya),outer_station(yb)
    for i,j in [(0,1),(1,2),(2,0)]:
        outward=Vector((0,0,1)) if i==0 else Vector((1 if i==1 else -1,0,-.37)).normalized()
        offset=outward*.0265
        vs=[a[i]+offset,b[i]+offset,b[j]+offset,a[j]+offset]
        # Top from left forward to right = -Z; orient all faces to their intended exterior.
        if (vs[1]-vs[0]).cross(vs[2]-vs[0]).dot(outward)<0:vs.reverse()
        skin.mesh(vs,[(0,1,2,3)],False,linen if i==0 else under,[(p.y*1.6,(p.x if i==0 else p.z)*1.6) for p in vs])
        pipe(tapes,[a[i]+offset*1.07,b[i]+offset*1.07],.009,6)
        pipe(tapes,[a[i]+offset*1.06,a[j]+offset*1.06],.008,5)
        if i!=0:
            ii=i if i==1 else j
            pipe(tapes,[a[ii]+offset*1.05,b[2]+offset*1.05],.006,5)
# Cockpit & forward skin are expanded from successive quasi-triangular cross sections.
def metal_section(y,a):
    w,_,zb=profile(y)
    w+=.034
    mid=.035
    h=interpolate(y,[(-.93,.338),(-.55,.371),(.30,.441),(.91,.466),(1.45,.475)])
    if cos(a)>=0:
        return Vector((w*sin(a),y,mid+h*cos(a)))
    d=-cos(a)
    return Vector((math.copysign(w*(1-d)**.84,sin(a)),y,mid+(zb-mid)*d))
def cut(y):
    yc=-.245; length=.532
    if abs(y-yc)>=length:return 0
    return .99*sqrt(max(0,1-((y-yc)/length)**2))
shell=part('Rolled aluminium deck • cockpit aperture',secF,'Alloy_Fuselage',metal)
ys=sorted(set([-.93,-.84,-.777,.287,.35,.66,.99,1.22,1.45]+[-.777+1.064*k/40 for k in range(41)]))
vs=[];uv=[];fs=[]
seg=60
for i,y in enumerate(ys):
    a0=cut(y)
    for j in range(seg+1):
        a=a0+(tau-2*a0)*j/seg
        pt=metal_section(y,a);vs.append(pt);uv.append((y,3*j/seg))
    if i:
        for j in range(seg):
            k=(i-1)*(seg+1)+j
            fs.append((k,k+seg+1,k+seg+2,k+1))
shell.mesh(vs,fs,True,metal,uv)
# Normal reversed in generic +Y loft: for angle 0 increasing angle moves +X, Y x X points down.
# Set outward deck normals before the mesh is materialized.
shell.f=[f[::-1] for f in shell.f]
coaming=part('Hand-stitched leather cockpit coaming',secC,'Cockpit_Details',leather)
opening=[-.777+1.064*k/64 for k in range(65)]
outline=[metal_section(y,cut(y)) for y in opening]+[metal_section(y,-cut(y)) for y in reversed(opening)]
pipe(coaming,outline+[outline[0]],.019,9)
rivets=part('Dzus-type heads, panel joints and rolled lips',secF,'Alloy_Seams',rolled)
for y in (-.91,.345,.92,1.43):
    start=cut(y)
    arc=[metal_section(y,start+(tau-2*start)*j/90) for j in range(91)]
    pipe(rivets,arc,.006,6)
    for j in range(0,90,4):
        pt=arc[j];d=Vector((pt.x,0,pt.z-.015)).normalized()
        c=pt+d*.005
        ellipsoid(rivets,c,(.007,.006,.006),rolled,8,4)
for s in (-1,1):
    path=[metal_section(y,s*1.57) for y in ys]
    pipe(rivets,path,.005,6)
    for k in range(28):
        y=-.89+2.28*k/27
        c=metal_section(y,s*1.57);c.x+=s*.004
        ellipsoid(rivets,c,(.006,.008,.008),rolled,8,4)

# Close the fire bulkhead and the inner forward deck; the viewer in the cockpit
# should see the dashboard and its timber back, even with grazing sightlines.
fire=part('Forward firewall and instrument shelf',secC,'Cockpit_Furnishings',iron)
rim=[metal_section(1.412,tau*j/48) for j in range(48)]
fire.mesh(rim,[tuple(range(48))],False,iron,[(p.x,p.z) for p in rim])
vs=[]
for y in [.283,.343]:
    for j in range(27):
        p=metal_section(y,-1.45+2.90*j/26)
        p.z-=.008; vs.append(p)
cover=[(j,j+1,j+28,j+27) for j in range(26)]
fire.mesh(vs,cover,True,walnut,[(p.x,p.y) for p in vs])
panel_outline=[metal_section(.342,-1.32+2.64*j/26) for j in range(27)]
panel_outline += [Vector((.26,.342,-.35)),Vector((-.26,.342,-.35))]
fire.mesh(panel_outline,[tuple(range(len(panel_outline)))],False,walnut,[(p.x,p.z) for p in panel_outline])
# The cockpit includes a dished seat, low wheel, pedals and representative period instruments.
furn=part('Seat boards, floor and back bulkhead',secC,'Cockpit_Furnishings',walnut)
for i in range(-2,3):
    x=i*.098
    strut(furn,(x,-.70,-.355),(x,.54,-.355),.013,.053)
for y,w,z in [(-.771,.36,.22),(.34,.377,.28)]:
    vs=[(-w,y,z),(w,y,z),(.27,y,-.39),(-.27,y,-.39)]
    furn.mesh(vs,[(0,1,2,3),(3,2,1,0)],False,walnut,[(0,0),(.8,0),(.8,.65),(0,.65)])
seat=part('Upholstered bucket • open front',secC,'Cockpit_Furnishings',leather)
ellipsoid(seat,(0,-.40,-.155),(.246,.232,.056),leather,32,10)
vs=[];fs=[];uv=[]
for i in range(25):
    ang=-pi*.54+pi*1.08*i/24
    for j in range(5):
        t=j/4;r=.241+.012*t
        vs.append((r*sin(ang),-.44-r*cos(ang),-.15+t*(.204+.165*max(cos(ang),0))))
        uv.append((i/24,j/4))
    if i:
        for j in range(4):
            k=(i-1)*5+j;fs.append((k,k+5,k+6,k+1))
seat.mesh(vs,fs,True,leather,uv)
pipe(seat,[vs[i*5+4] for i in range(25)],.010,7)
controls=part('Steering wheel, column and rudder bar',secC,'Cockpit_Instruments',iron)
wheel=Vector((0,.055,.205));axis=Vector((0,1,.62)).normalized()
torus(controls,wheel,axis,.148,.013,48,9,ash)
e1=Vector((1,0,0));e2=axis.cross(e1)
for i in range(4):
    a=tau*i/4+.35
    rod(controls,wheel,wheel+.141*(e1*cos(a)+e2*sin(a)),.006,8,gun)
rod(controls,wheel,(0,.12,-.32),.012,10,gun)
rod(controls,(-.22,.34,-.285),(.22,.34,-.285),.013,10,ash)
for s in (-1,1):
    torus(controls,(s*.158,.33,-.25),(0,1,0),.043,.005,20,5,gun)
    rod(controls,(s*.275,-.2,.055),(s*.275,-.105,.178),.006,8,brass)
    ellipsoid(controls,(s*.275,-.105,.179),(.015,.015,.021),ebonite,10,6)
panel=part('Varnished dashboard and simple gauges',secC,'Cockpit_Instruments',ash)
strut(panel,(-.29,.302,.207),(.29,.302,.207),.019,.065)
for x,r in [(-.145,.048),(0,.054),(.142,.038)]:
    ctr=Vector((x,.274,.209))
    rod(panel,ctr-Vector((0,.008,0)),ctr+Vector((0,.008,0)),r,24,ebonite)
    torus(panel,ctr-Vector((0,.010,0)),(0,1,0),r,.004,32,5,brass)
    for j in range(11):
        a=pi*(j/7.5-.67)
        d=Vector((sin(a),0,cos(a)))
        rod(panel,ctr-Vector((0,.012,0))+d*r*.76,ctr-Vector((0,.012,0))+d*r*.90,.0014,4,porcelain)
    rod(panel,ctr-Vector((0,.014,0)),ctr+Vector((.43*r,-.014,.48*r)),.0018,5,porcelain)

# Rounded edges of the swept fixed tail and independently hinged elevator.
hinge_el=-5.035
el_origin=(0,hinge_el,.154);rud_origin=(0,-5.26,.32);prop_origin=(0,2.00,.045)
def tail_bounds(a):
    leading=interpolate(a,[(0,-3.13),(.32,-3.38),(1.20,-4.17),(1.43,-4.47),(1.52,-4.72)])
    trailing=interpolate(a,[(0,-5.48),(.38,-5.49),(1.18,-5.46),(1.42,-5.405),(1.52,-5.30)])
    return leading,trailing
def tail_xyz(s,a,t,kind,face):
    le,te=tail_bounds(a)
    if kind=='Tailplane': lo,hi=le,hinge_el+.009
    else: lo,hi=hinge_el-.009,te
    return (s*a,lo+(hi-lo)*t,.154+.017*sin(pi*t)*(1-.25*a)+face*(.006+.018*sin(pi*t)))
for s,side in [(-1,'L'),(1,'R')]:
    rib=[.040,.28,.52,.76,1.0,1.23,1.42,1.52]
    for kind in ['Tailplane','Elevator']:
        sh=part(kind+' • linen shell '+side,secT,'Fabric_'+kind,linen)
        sk=part(kind+' • skeleton '+side,secFrame,'Structure_'+kind,spruce)
        xseq=[a+(b-a)*k/3 for a,b in zip(rib,rib[1:]) for k in range(3)]+[rib[-1]]
        ts=[0,.12,.28,.50,.72,.88,1]
        for f in [1,-1]:
            vs=[tail_xyz(s,a,t,kind,f) for a in xseq for t in ts];fs=[];n=len(ts)
            for i in range(len(xseq)-1):
                for j in range(n-1):
                    k=i*n+j; face=(k,k+n,k+n+1,k+1)
                    fs.append(face if s*f<0 else face[::-1])
            sh.mesh(vs,fs,True,linen if f==1 else under,[(p[0]*2,p[1]*2) for p in vs])
        for a in rib:
            points=[tail_xyz(s,min(a,1.50),.04+.92*t,kind,0) for t in ts]
            pipe(sk,points,.009,6)
            if a!=rib[0]:
                pp=[tuple(Vector(tail_xyz(s,a,t,kind,1))+Vector((0,0,.002))) for t in ts]
                ribbon(sh,pp,(.007,0,0),tape)
        for t in [.06,.91]:
            pipe(sk,[tail_xyz(s,min(a,1.50),t,kind,0) for a in xseq],.009,8,ash)
        for a in [rib[0],rib[-1]]:
            pipe(sh,[tail_xyz(s,a,t,kind,0) for t in ts],.008,8,tape)
# Fabric-covered surfaces around a deep empennage post; angle coordinates given in the Y/Z plane.
def vertical_surface(name,stations,top,btm):
    fabric=part(name+' • fabric',secT,'Fabric_'+name,linen)
    timber=part(name+' • outline and ribs',secFrame,'Structure_'+name,spruce)
    for sign in (-1,1):
        vs=[];uv=[]
        for i,y in enumerate(stations):
            for t in [0,.25,.5,.75,1]:
                z=btm[i]*(1-t)+top[i]*t
                vs.append((sign*(.016+.004*sin(pi*t)),y,z))
                uv.append((y*2,z*2))
        fs=[]
        for i in range(len(stations)-1):
            for j in range(4):
                k=i*5+j;f=(k,k+5,k+6,k+1)
                fs.append(f if sign<0 else f[::-1])
        fabric.mesh(vs,fs,True,linen if sign>0 else under,uv)
        for i in range(1,len(stations)-1):
            if i%2==0 or name=='Fin':
                y=stations[i]
                if top[i]-btm[i]>.18:
                    p=[(sign*.022,y,btm[i]+.007),(sign*.022,y,top[i]-.007)]
                    ribbon(fabric,p,(0,.006,0),tape)
    for zs in (top,btm):
        pipe(timber,[(0,y,z) for y,z in zip(stations,zs)],.015,8)
    for y,zt,zb in zip(stations,top,btm):
        if zt-zb>.08: strut(timber,(0,y,zt),(0,y,zb),.010,.009)
    for y,zt,zb in [(stations[0],top[0],btm[0]),(stations[-1],top[-1],btm[-1])]:
        if abs(zt-zb)>.02:pipe(fabric,[(0,y,zt),(0,y,zb)],.017,8,tape)
vertical_surface('Fin',[-3.03,-3.58,-4.17,-4.75,-5.23],[.24,.37,.51,.65,.735],[.219,.20,.18,.16,.145])
vertical_surface('Rudder',[-5.263,-5.45,-5.71,-5.82,-5.86,-5.88],[.734,.732,.705,.690,.675,.64],[-.095,-.093,-.083,-.065,-.032,.015])
hinges=part('Tail hinges, horns and control wires',secR,'Rigging_Tail',iron)
rod(hinges,(0,-5.249,-.095),(0,-5.249,.75),.014,10)
for z in (0,.33,.63):
    rod(hinges,(0,-5.245,z-.025),(0,-5.245,z+.025),.024,10,rolled)
for s in (-1,1):
    for x in [.40,1.16]:
        rod(hinges,(s*x-.032,hinge_el,.153),(s*x+.032,hinge_el,.153),.018,10,iron)
    strut(hinges,(s*.014,-5.29,.071),(s*.215,-5.37,.08),.014,.009)
    p1=(s*.221,-5.36,.081);p2=(s*.34,-.96,.083)
    rod(hinges,p1,p2,.0032,6,wire)
    strut(hinges,(s*.32,-5.09,.16),(s*.32,-5.12,-.02),.012,.010)
    rod(hinges,(s*.32,-5.12,-.02),(s*.32,-.96,-.18),.003,6,wire)
    rod(hinges,(s*1.13,-4.82,.15),(s*.018,-5.15,.63),.004,6,wire)
    rod(hinges,(s*1.13,-4.82,.145),(s*.026,-4.5,-.045),.004,6,wire)

# Steel cabane with eyelets and a wire fan on each side, matching the Shuttleworth photographs.
cab=part('Cabane pyramid and reinforced apex',secR,'Rigging_Cabane',iron)
apex=Vector((0,.56,1.38))
for s in (-1,1):
    for y in (-.24,1.14):
        low=Vector((s*.351,y,.281))
        rod(cab,low,apex,.0145,9)
        rod(cab,low,low+(apex-low).normalized()*.068,.021,9,rolled)
ellipsoid(cab,apex,(.039,.043,.043),iron,14,8)
torus(cab,(0,.56,1.418),(0,1,0),.025,.006,18,6,rolled)

# Rotary's crankcase, seven separately built finned cylinders, heads, pushrods and plugs.
rot=part('Omega • central crankcase and crankshaft',secP,'Propeller',gun,prop_origin)
lathe_y(rot,[(1.48,.17,.045,.17),(1.52,.205,.045,.205),(1.62,.211,.045,.211),(1.70,.173,.045,.173),(1.76,.145,.045,.145),(1.85,.122,.045,.122),(1.94,.074,.045,.074)],segments=48,mat=gun)
# Lathe contour runs aft-to-forward; reverse winding for outward surface.
rot.f=[f[::-1] for f in rot.f]
for j in range(14):
    a=tau*j/14
    stud=Vector((.162*sin(a),1.705,.045+.162*cos(a)))
    rod(rot,stud-Vector((0,.006,0)),stud+Vector((0,.010,0)),.012,6,rolled)
for i in range(7):
    a=tau*i/7+.06
    v=Vector((sin(a),0,cos(a))); tang=Vector((cos(a),0,-sin(a)))
    ctr=Vector((0,1.61,.045))
    def pc(rad,forward=0,offset=0):return ctr+v*rad+Vector((0,forward,0))+tang*offset
    cy=part(f'Omega • cylinder {i+1} with cooling fins',secP,'Propeller',gun,prop_origin)
    pipe(cy,[pc(.161),pc(.19),pc(.251),pc(.377),pc(.399)],[.067,.081,.076,.083,.071],20)
    for j in range(10):
        r=.233+j*.015
        pipe(cy,[pc(r-.004),pc(r+.004)],[.092+.003*j/10,.092+.003*j/10],20,iron)
    pipe(cy,[pc(.399),pc(.42),pc(.432)],[.082,.071,.041],18,gun)
    rod(cy,pc(.198,.084,-.037),pc(.419,.079,-.037),.0053,7,rolled)
    rod(cy,pc(.198,.084,.037),pc(.419,.079,.037),.0053,7,rolled)
    rod(cy,pc(.411,.044),pc(.441,.052),.016,8,brass)
    rod(cy,pc(.44,.052),pc(.464,.057),.012,8,porcelain)
    pipe(cy,[pc(.463,.055),pc(.47,.066),pc(.432,.091,.012),pc(.365,.102,.024)],.0036,6,iron)
    rod(cy,pc(.399,.075,-.05),pc(.399,.077,.051),.008,7,rolled)
# Hemispherical forward lip over the upper engine; the bottom half stays open.
cowl=part('Open-bottom horseshoe cowl',secP,'Alloy_Cowling',metal)
for section,angles in [
 ([(1.422,.453,.045,.457),(1.48,.484,.045,.480),(1.65,.505,.045,.501),(1.75,.505,.045,.502),(1.81,.493,.045,.49),(1.856,.456,.045,.453),(1.88,.394,.045,.395),(1.884,.345,.045,.345)],(-1.83,1.83))]:
    lathe_y(cowl,section,angles,66)
cowl.f=[f[::-1] for f in cowl.f]
trim=part('Cowling rolled edges & fasteners',secP,'Alloy_Cowling',rolled)
for y,r,lim in [(1.88,.346,1.83),(1.432,.461,1.83)]:
    pipe(trim,[(r*sin(a),y,.045+r*cos(a)) for a in np.linspace(-lim,lim,74)],.009,7)
for s in (-1,1):
    p=[(r*sin(s*1.83),y,.045+h*cos(s*1.83)) for y,r,_,h in section]
    pipe(trim,p,.009,7)
for j in range(15):
    a=-1.73+j*(3.46/14)
    p=(.478*sin(a),1.473,.045+.477*cos(a))
    ellipsoid(trim,p,(.011,.009,.010),gun,8,4)
# An asymmetric laminated wooden cross section twists continuously from root to tip.
blade=part('Two-blade carved airscrew',secP,'Propeller',walnut,prop_origin)
stations=[(.042,.064,0,42),(.18,.082,.004,39),(.29,.091,.019,33),(.43,.097,.037,28),(.61,.108,.054,22),(.79,.115,.074,17),(.94,.108,.081,13),(1.055,.089,.082,10),(1.136,.051,.070,8),(1.158,.010,.056,8)]
for s in (-1,1):
    phi=.97+(0 if s==1 else pi)
    radial=Vector((sin(phi),0,cos(phi))); chord=Vector((cos(phi),0,-sin(phi)));fore=Vector((0,1,0))
    vs=[];uv=[];fs=[];N=20
    for rr,w,sweep,ang in stations:
        pitch=math.radians(ang)
        c=Vector(prop_origin)+radial*rr+chord*sweep
        for j in range(N):
            a=tau*j/N
            t=w*cos(a)
            thickness=(.049*(1-rr/1.21)+.007)*sin(a)
            cvec=chord*cos(pitch)+fore*sin(pitch)
            nvec=fore*cos(pitch)-chord*sin(pitch)
            vs.append(c+cvec*t+nvec*thickness);uv.append((rr*1.60,cos(a)*.16+.50))
    for k in range(len(stations)-1):
        for j in range(N):
            v=k*N+j; nk=k*N+(j+1)%N
            fs.append((v,nk,nk+N,v+N))
    fs.append(tuple(reversed(range(N))));fs.append(tuple(range(len(vs)-N,len(vs))))
    blade.mesh(vs,fs,True,walnut,uv)
    # Very fine lamination lines follow the curved blade edge.
    line=[vs[i*N+N//2] for i in range(1,len(stations))]
    pipe(blade,line,.0029,5,lamella)
hub=part('Propeller flange, lock nut and eight bolts',secP,'Propeller',gun,prop_origin)
cen=Vector(prop_origin)
for y,r in [(1.937,.117),(2.052,.111)]:
    rod(hub,(0,y,.045),(0,y+.017,.045),r,36,gun)
torus(hub,(0,2.068,.045),(0,1,0),.091,.004,36,6,rolled)
rod(hub,(0,2.065,.045),(0,2.121,.045),.043,8,brass)
for i in range(8):
    a=tau*i/8
    rod(hub,(.078*sin(a),2.067,.045+.078*cos(a)),(.078*sin(a),2.090,.045+.078*cos(a)),.011,6,rolled)

# Twin hockey-stick chassis runners, sprung axle, and fine laced wire wheels.
gear=part('Chassis • varnished skids and four wood legs',secG,'Chassis_Frame',ash)
gear_metal=part('Chassis • axle clips and iron fittings',secG,'Chassis_Fittings',gun)
bindings=part('Chassis • shock cords and lashings',secG,'Chassis_Fittings',leather)
axle_z=-1.08; axle_y=1.04
for s in [-1,1]:
    x=s*.48
    skid=[(x,-.12,-1.219),(x,.04,-1.244),(x,.47,-1.256),(x,1.10,-1.248),(x,1.47,-1.204),(x,1.695,-1.134),(x,1.833,-1.012),(x,1.90,-.876)]
    pipe(gear,skid,[.024,.030,.034,.034,.032,.030,.027,.021],9)
    for top,low in [((s*.37,1.28,.078),(x,1.405,-1.22)),((s*.36,-.385,-.021),(x,.20,-1.24))]:
        strut(gear,top,low,.045,.027)
        hi=Vector(top);lo=Vector(low);di=(hi-lo).normalized()
        rod(gear_metal,hi,hi-di*.105,.041,8)
        rod(gear_metal,lo,lo+di*.083,.039,8)
    rod(gear_metal,(x,1.41,-1.196),(x,.24,-1.19),.011,8)
    # V-shaped sprung secondary assembly from the axle to the long ski.
    for y in [.70,1.29]:
        rod(gear_metal,(x,axle_y,axle_z),(x,y,-1.233),.013,8)
    for j in range(5):
        torus(bindings,(x+(j-2)*.012,axle_y,-1.159),(1,0,0),.078,.006,28,6,leather)
    for ya,yb in [(1.21,.24),(-.385,1.405)]:
        rod(gear_metal,(s*.34,ya,-.08),(x,yb,-1.20),.0043,6,wire)
rod(gear_metal,(-.755,axle_y,axle_z),(.755,axle_y,axle_z),.023,16,gun)
for y in [.22,1.42]:
    rod(gear_metal,(-.48,y,-1.219),(.48,y,-1.219),.012,8,gun)
for s,side in [(-1,'L'),(1,'R')]:
    tire=part('Wheel '+side+' • pale rubber and rolled rim',secG,'Chassis_Wheels',rubber)
    lacing=part('Wheel '+side+' • tangential wire lacing',secG,'Chassis_Spokes',wire)
    cx=s*.69; ctr=Vector((cx,axle_y,axle_z))
    torus(tire,ctr,(1,0,0),.350,.035,72,12)
    for off in [-.017,.017]:
        torus(tire,ctr+Vector((off,0,0)),(1,0,0),.321,.011,64,7,rolled)
    rod(tire,ctr+Vector((-.059,0,0)),ctr+Vector((.059,0,0)),.032,20,gun)
    for side_of_hub in [-1,1]:
        flange=ctr+Vector((side_of_hub*.048,0,0))
        rod(tire,flange-Vector((.004,0,0)),flange+Vector((.004,0,0)),.045,24,rolled)
        for j in range(20):
            a=tau*j/20+(.056 if side_of_hub<0 else 0)
            shift=.53 if j%2==0 else -.53
            p=flange+Vector((0,.038*cos(a+shift),.038*sin(a+shift)))
            q=ctr+Vector((side_of_hub*.014,.322*cos(a),.322*sin(a)))
            rod(lacing,p,q,.0034,5)
    rod(tire,ctr+Vector((s*.052,0,0)),ctr+Vector((s*.083,0,0)),.027,6,brass)
# Rear ash skid and replaceable small iron shoe.
skid=part('Tail skid, iron shoe and sprung mount',secG,'Chassis_TailSkid',ash)
tpath=[(0,-3.48,-.182),(0,-3.80,-.298),(0,-4.14,-.41),(0,-4.50,-.482),(0,-4.76,-.522),(0,-4.87,-.528)]
pipe(skid,tpath,[.023,.028,.031,.029,.025,.019],8)
pipe(skid,[(0,-4.56,-.501),(0,-4.76,-.538),(0,-4.87,-.542)],[.010,.010,.008],7,gun)
for x in [-.091,.091]:
    strut(skid,(x,-4.28,.085),(0,-4.50,-.466),.016,.012,iron)
for j in range(4):
    torus(skid,(0,-4.475-j*.016,-.469),(0,1,0),.033,.005,16,5,leather)
# Flying wires terminate at spar stations; turnbuckles consist of barrels, clevis and end ferrules.
standing=part('Upper and lower wing wire fans',secR,'Rigging_Wires',wire)
tension=part('Forks, eye plates and turnbuckles',secR,'Rigging_Turnbuckles',brass)
def line_with_ends(a,b,r,hardware=True):
    a=Vector(a);b=Vector(b)
    rod(standing,a,b,r,6)
    d=(b-a).normalized()
    if hardware:
        for p,dn in [(a,d),(b,-d)]:
            rod(tension,p+dn*.025,p+dn*.053,.008,6,gun)
            rod(tension,p+dn*.054,p+dn*.112,.010,6,brass)
            rod(tension,p+dn*.112,p+dn*.134,.006,6,gun)
for s in [-1,1]:
    for xa in [2.36,4.20]:
        for t in [.23,.65]:
            w1=Vector(wing_coords(s*xa,t,1));w2=Vector(wing_coords(s*xa,t,-1))
            line_with_ends(apex+Vector((s*.011,(t-.4)*.09,0)),w1,.0045)
            base=Vector((s*.48,1.33 if t<.5 else .245,-1.215))
            line_with_ends(base,w2,.0045)
            ellipsoid(tension,w1,(.035,.024,.009),gun,10,5)
    # Lateral diagonal between the landing gear legs.
    line_with_ends((s*.34,-.29,-.02),(-s*.47,.24,-1.18),.004,False)
    line_with_ends((s*.32,1.20,-.04),(-s*.46,1.365,-1.14),.004,False)

# Preserve component-level meshes in the Blender master. Merge web meshes only by
# logical layer so the fabric can be removed with one switch, and moving parts retain pivots.
aircraft_parts=list(parts)
scene=bpy.context.scene
scene.name='Blackburn • 1912'
scene.unit_settings.system='METRIC'
scene.world=bpy.data.worlds.new('Neutral studio')
scene.world.color=(.25,.25,.25)
for name in dict.fromkeys(p.category for p in aircraft_parts):
    c=bpy.data.collections.new(name);scene.collection.children.link(c);sections[name]=c
origins={'Propeller':prop_origin,'Rudder':rud_origin,'Elevator':el_origin}
def dynamic(ex):
    if ex=='Propeller':return 'Propeller'
    if ex.endswith('_Elevator'):return 'Elevator'
    if ex.endswith('_Rudder'):return 'Rudder'
    return None
def pivot(name,collection):
    obj=bpy.data.objects.new(name,None);collection.objects.link(obj);obj.empty_display_type='PLAIN_AXES'
    obj.empty_display_size=.12;obj.location=origins[name]
    return obj
articulations={tag:pivot(tag,sections[secP if tag=='Propeller' else secT]) for tag in origins}
for p in aircraft_parts:
    motion=dynamic(p.export)
    if motion:p.origin=Vector(origins[motion])
    obj=p.object(sections[p.category])
    if motion:
        obj.parent=articulations[motion]; obj.location=(0,0,0)
    obj['Web layer']=p.export
scene['Aircraft']='Blackburn Type D, preserved configuration of G-AANI'
scene['Scale']='Shuttleworth Collection: span 31 ft 10.5 in, length 26 ft 3 in, single-seat 50 hp Gnôme Omega.'
scene['Reconstruction']='Interpretive digital reconstruction. Local rib positions, cockpit fittings, material shades and hardware are approximate.'
scene['Museum']='https://www.shuttleworth.org/discover/collection/aircraft/blackburn-monoplane'
scene['Reference']='User-supplied Alex Whittaker R/C cutaway; scale model, not factory drawings.'
scene['Inspection']='Mesh collections separate the envelope, internal woodwork, cockpit, rigging, running gear and engine. Propeller, rudder and elevator each have a pivot.'
for ar in bpy.context.screen.areas:
    if ar.type=='VIEW_3D':
        sp=ar.spaces.active; s3=sp.shading
        s3.type='SOLID';s3.light='STUDIO';s3.color_type='MATERIAL'
        s3.show_shadows=True;s3.show_cavity=True;s3.cavity_type='WORLD'
        s3.cavity_ridge_factor=1.05;s3.cavity_valley_factor=1.05
        sp.overlay.show_floor=False;sp.overlay.show_axis_x=False;sp.overlay.show_axis_y=False
        sp.overlay.show_extras=False;sp.region_3d.view_distance=12.5
        target=Vector((0,-.9,0));eye=Vector((8.8,9.8,4.8))
        sp.region_3d.view_rotation=(eye-target).to_track_quat('Z','Y')
        sp.region_3d.view_location=target;sp.region_3d.view_perspective='ORTHO'
scene.render.engine='CYCLES'
scene.cycles.samples=48
bpy.ops.wm.save_as_mainfile(filepath=str(outputs/'Blackburn-Type-D.blend'),compress=True)
# The web export uses a second, transient scene: no editor-only geometry is hidden
# in the master and no game-only duplication lands in the saved blend.
web=bpy.data.scenes.new('Optimized glTF')
bpy.context.window.scene=web
pivots={tag:pivot(tag,web.collection) for tag in ['Rudder','Elevator']}
# Existing ID names in other scenes must not steal the case-sensitive GLB pivot names.
for tag in origins:
    articulations[tag].name='Editor pivot • '+tag
for tag,node in pivots.items():node.name=tag
grouped={}
for p in aircraft_parts:
    if p.export not in grouped:
        parent=dynamic(p.export)
        org=origins[parent] if parent else (0,0,0)
        grouped[p.export]=Part(p.export,'web',p.export,p.material,org)
    grouped[p.export].merge(p)
for name,p in grouped.items():
    o=p.object(web.collection,name)
    motion=dynamic(name)
    if motion in pivots:
        o.parent=pivots[motion];o.location=(0,0,0)
bpy.context.view_layer.update()
bpy.ops.export_scene.gltf(filepath=str(work/'aircraft.glb'),export_format='GLB',use_active_scene=True,export_cameras=False,export_lights=False,export_yup=True,export_animations=False,export_extras=False)
print('AIRCRAFT_CREATED',len(aircraft_parts),'editor meshes;',len(grouped),'merged web meshes')
