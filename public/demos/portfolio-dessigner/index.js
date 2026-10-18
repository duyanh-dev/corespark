gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ignoreMobileResize:true});
const $=s=>document.querySelector(s),$$=s=>gsap.utils.toArray(s);
const fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
let accMeshes=[],curAcc='#ff3d81';
function setAcc(c){curAcc=c;document.documentElement.style.setProperty('--acc',c);accMeshes.forEach(m=>m.material.color.set(c))}

/* ---------- intro curtain ---------- */
(function(){
  document.body.style.overflow='hidden';
  gsap.timeline({onComplete(){$('#intro').remove();document.body.style.overflow='';ScrollTrigger.refresh()}})
    .from('.itx',{scale:.6,opacity:0,duration:.6,ease:'back.out(2)'})
    .to('.itx',{opacity:0,y:-24,duration:.3},'+=.5')
    .to('.strips i',{yPercent:-100,duration:.8,ease:'expo.inOut',stagger:.08},'<');
})();

/* hero text */
$$('.line').forEach(l=>{l.innerHTML=[...l.textContent].map(c=>`<span class="ch">${c===' '?'&nbsp;':c}</span>`).join('')});
gsap.set('.ch',{yPercent:115,rotate:8});
gsap.to('.ch',{yPercent:0,rotate:0,duration:1.1,stagger:.045,ease:'expo.out',delay:1.5});
gsap.from('.hero p,.hero .btn',{y:30,opacity:0,duration:.9,stagger:.12,delay:2.2,ease:'power3.out'});

/* ---------- hero 3D: pen tool bezier ---------- */
(function(){
  const el=$('#stage'),R=new THREE.WebGLRenderer({antialias:true,alpha:true}),cv=R.domElement;
  R.setPixelRatio(Math.min(devicePixelRatio,1.75));el.prepend(cv);
  const S=new THREE.Scene(),cam=new THREE.PerspectiveCamera(40,1,.1,100),G=new THREE.Group();S.add(G);
  S.add(new THREE.AmbientLight(0xffffff,.8));const dl=new THREE.DirectionalLight(0xffffff,1);dl.position.set(4,6,8);S.add(dl);
  const INK=0x14102b,edge=(g,a)=>new THREE.LineSegments(new THREE.EdgesGeometry(g,a),new THREE.LineBasicMaterial({color:INK}));
  const hitG=new THREE.SphereGeometry(1,8,6),pts=[],hits=[];
  [[-4.2,-1.4,1],[-2.3,3.5,0],[2.3,-3.5,0],[4.2,1.4,1]].forEach(([x,y,a],i)=>{
    const g=a?new THREE.BoxGeometry(.6,.6,.6):new THREE.SphereGeometry(.3,16,12);
    const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:a?0xffffff:0x3a2cff,roughness:.7}));
    if(a)m.add(edge(g,35));
    m.position.set(x,y,0);G.add(m);pts.push(m);
    const h=new THREE.Mesh(hitG,new THREE.MeshBasicMaterial({visible:false}));h.userData.i=i;m.add(h);hits.push(h);
  });
  const curve=new THREE.CubicBezierCurve3(),tube=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial({color:0xff3d81,roughness:.6}));
  G.add(tube);accMeshes.push(tube);
  const lines=[0,1].map(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:INK}));l.frustumCulled=false;G.add(l);return l});
  const ln=(l,a,b)=>{const p=l.geometry.attributes.position;p.setXYZ(0,a.x,a.y,a.z);p.setXYZ(1,b.x,b.y,b.z);p.needsUpdate=true};
  let ip=0;
  const dr=()=>{const g=tube.geometry;g.setDrawRange(0,ip>=1?Infinity:Math.floor(g.index.count*ip/6)*6)};
  function upd(){
    [curve.v0,curve.v1,curve.v2,curve.v3].forEach((v,i)=>v.copy(pts[i].position));
    tube.geometry.dispose();tube.geometry=new THREE.TubeGeometry(curve,70,.3,10,false);dr();
    ln(lines[0],pts[0].position,pts[1].position);ln(lines[1],pts[3].position,pts[2].position);
  }
  const pen=new THREE.Mesh(new THREE.ConeGeometry(.3,1,4),new THREE.MeshStandardMaterial({color:INK,flatShading:true}));pen.visible=false;G.add(pen);
  const decor=[[new THREE.CylinderGeometry(.75,.75,.3,28),0xff3d81,[-4.6,3.5,-1.5]],[new THREE.BoxGeometry(1.2,1.2,.3),0x3a2cff,[4.6,-3.7,-1.5]],[new THREE.CylinderGeometry(.9,.9,.3,3),0xffd23f,[.4,4.3,-1.5]]].map(([g,c,p])=>{
    const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:c,roughness:.7}));m.add(edge(g,40));m.position.set(...p);m.rotation.x=1.2;
    m.userData={css:'#'+c.toString(16).padStart(6,'0'),b:p[1],ph:Math.random()*6};G.add(m);return m});
  upd();
  const o={v:0};gsap.to(o,{v:1,duration:2,ease:'power2.inOut',delay:1.9,onUpdate(){ip=o.v;dr()},onComplete(){pen.visible=true}});
  gsap.from(pts.map(p=>p.scale),{x:0,y:0,z:0,duration:1,stagger:.15,ease:'back.out(3)',delay:1.9});
  gsap.from(decor.map(p=>p.scale),{x:0,y:0,z:0,duration:1.4,stagger:.1,ease:'elastic.out(1,.5)',delay:2.6});
  gsap.to(G.position,{y:3,scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:true}});
  let zc=14;
  new ResizeObserver(()=>{const w=el.clientWidth,h=el.clientHeight,a=w/h;R.setSize(w,h);cam.aspect=a;zc=Math.max(14,5.8/(a*.364));cam.updateProjectionMatrix()}).observe(el);

  const ray=new THREE.Raycaster(),m2=new THREE.Vector2(),pl=new THREE.Plane(),pt=new THREE.Vector3(),off=new THREE.Vector3(),tg=new THREE.Vector3(),UP=new THREE.Vector3(0,1,0);
  let dg=null,tx=0,ty=0,on=true;
  const nd=e=>{const b=cv.getBoundingClientRect();m2.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);ray.setFromCamera(m2,cam)};
  const pk=()=>{const h=ray.intersectObjects(hits,false)[0];return h?h.object.userData.i:-1};
  const pd=()=>ray.intersectObjects(decor,false)[0]?.object;
  cv.addEventListener('pointerdown',e=>{
    nd(e);const i=pk();
    if(i>-1){dg=i;const wp=pts[i].position.clone().add(G.position);
      pl.setFromNormalAndCoplanarPoint(cam.getWorldDirection(new THREE.Vector3()).negate(),wp);
      ray.ray.intersectPlane(pl,pt);off.copy(wp).sub(pt);cv.setPointerCapture(e.pointerId);
      gsap.to(pts[i].scale,{x:1.4,y:1.4,z:1.4,duration:.3});
    }else{const d=pd();if(d){setAcc(d.userData.css);gsap.fromTo(d.rotation,{y:0},{y:6.283,duration:1,ease:'back.out(1.5)'})}}
  });
  cv.addEventListener('touchstart',e=>{if(dg!==null)e.preventDefault()},{passive:false});
  cv.addEventListener('pointermove',e=>{
    nd(e);
    if(dg!==null){
      if(!ray.ray.intersectPlane(pl,pt))return;
      pt.add(off).sub(G.position);pt.z=0;
      const hh=cam.position.z*.364,hw=hh*cam.aspect;
      pt.x=gsap.utils.clamp(-hw+.6,hw-.6,pt.x);pt.y=gsap.utils.clamp(-hh+.6,hh-.6,pt.y);
      const p=pts[dg],d=pt.clone().sub(p.position);p.position.copy(pt);
      if(dg===0)pts[1].position.add(d);if(dg===3)pts[2].position.add(d);
      upd();
    }else if(e.pointerType==='mouse'){tx=m2.x;ty=m2.y;cv.style.cursor=pk()>-1?'grab':pd()?'pointer':'default'}
  });
  const end=()=>{if(dg!==null){gsap.to(pts[dg].scale,{x:1,y:1,z:1,duration:.8,ease:'elastic.out(1,.4)'});dg=null}};
  cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
  cv.addEventListener('pointerleave',()=>{if(dg===null)tx=ty=0});
  new IntersectionObserver(([e])=>on=e.isIntersecting).observe(el);
  const clk=new THREE.Clock();
  (function L(){
    requestAnimationFrame(L);if(!on)return;
    const t=clk.getElapsedTime();
    cam.position.set(tx*1.6+Math.sin(t*.4)*.4,ty*1+Math.cos(t*.3)*.3,zc);cam.lookAt(0,0,0);
    decor.forEach(d=>{d.position.y=d.userData.b+Math.sin(t+d.userData.ph)*.3;d.rotation.z+=.006});
    if(pen.visible){const k=(t*.12)%1;curve.getPoint(k,pen.position);pen.position.z=.45;curve.getTangent(k,tg);pen.quaternion.setFromUnitVectors(UP,tg)}
    R.render(S,cam);
  })();
})();


/* ---------- works: pinned horizontal ---------- */
const P=[
['Nơ Coffee','Nhận diện thương hiệu','2025','#ff3d81','#ffc9dc',[['circle',62,'#ffd23f',50,48,1],['ring',34,'#14102b',26,74,2],['bean',24,'#14102b',74,24,3],['sq',13,'#fff',22,20,1.6]]],
['Hồ Sen','App đặt phòng','2025','#ffd23f','#fff0b8',[['ring',66,'#14102b',50,50,1],['circle',26,'#ff3d81',50,50,2],['pill',34,'#fff',72,80,1.5],['tri',14,'#3a2cff',24,22,3]]],
['Kỳ Lân','Poster và chuyển động','2024','#3a2cff','#cdc9ff',[['tri',60,'#ffd23f',50,52,1],['circle',22,'#ff3d81',26,24,2.4],['half',34,'#fff',74,78,1.4],['sq',12,'#14102b',78,20,3]]],
['Mây Tea','Thiết kế bao bì','2024','#19c37d','#c2f0dd',[['half',58,'#fff',50,44,1],['circle',24,'#14102b',28,76,2],['pill',40,'#ffd23f',72,72,1.6],['ring',18,'#14102b',76,22,3]]],
['Đom Đóm','Website triển lãm','2023','#ff8a2b','#ffdcbd',[['sq',50,'#14102b',50,50,1],['circle',34,'#ffd23f',50,50,2],['tri',16,'#fff',20,20,3],['ring',20,'#3a2cff',80,80,1.6]]]];
const track=$('.hw-track'),narrow=innerWidth<820;
track.innerHTML=`<div class="pn in"><div class="pt"><h2 class="d">Dự án<br>chọn lọc</h2><small>${fine?'Cuộn xuống':'Vuốt lên'} để lướt ngang</small></div></div>`+
P.map((p,i)=>`<div class="pn"><span class="num d">${i+1}</span><div class="pt"><h3 class="d">${p[0]}</h3><small>${p[1]}, ${p[2]}</small><a class="btn" href="#">Xem dự án</a></div><div class="pw"><div class="tl"><div class="ps" style="--c:${p[3]}">${p[5].map(s=>`<i class="sh s-${s[0]}" data-d="${s[5]}" style="--s:${s[1]}%;--c:${s[2]};left:${s[3]}%;top:${s[4]}%"><u><b class="${'ring sq tri'.includes(s[0])?'spin':''}"></b></u></i>`).join('')}</div></div></div></div>`).join('');
const act=i=>{gsap.to('#works',{backgroundColor:i?P[i-1][4]:'#e4e1ff',duration:.6,overwrite:'auto'});$('#hc').textContent=String(i).padStart(2,'0')+' / 0'+P.length;$('#hn').textContent=i?P[i-1][0]:'Dự án chọn lọc'};
const bar=$('.hw-bar i');
const tw=gsap.to(track,{x:()=>-(track.scrollWidth-innerWidth),ease:'none',scrollTrigger:{trigger:'#works',pin:true,scrub:.5,start:'top top',end:()=>'+='+(track.scrollWidth-innerWidth),invalidateOnRefresh:true,onUpdate:s=>bar.style.transform=`scaleX(${s.progress})`}});
$$('.pn').forEach((pn,i)=>{
  const sc=(extra={})=>({containerAnimation:tw,trigger:pn,start:'left right',end:'right left',scrub:true,...extra});
  ScrollTrigger.create({containerAnimation:tw,trigger:pn,start:'left 55%',end:'right 55%',onToggle:s=>s.isActive&&act(i)});
  if(!i)return;
  gsap.fromTo(pn.querySelector('.ps'),{rotation:8},{rotation:-8,ease:'none',scrollTrigger:sc()});
  gsap.fromTo(pn.querySelector('h3'),{x:narrow?60:160},{x:narrow?-60:-160,ease:'none',scrollTrigger:sc()});
  pn.querySelectorAll('.sh').forEach(s=>{const d=+s.dataset.d*(narrow?40:70);gsap.set(s,{xPercent:-50,yPercent:-50});gsap.fromTo(s,{x:d},{x:-d,ease:'none',scrollTrigger:sc()})});
  const ps=pn.querySelector('.ps');
  ps.addEventListener('click',()=>gsap.fromTo(ps.querySelectorAll('u'),{scale:.4,rotation:-40},{scale:1,rotation:0,duration:1.1,ease:'elastic.out(1,.35)',stagger:.06}));
});
if(fine)$$('.pw').forEach(w=>{const tl=w.querySelector('.tl'),rx=gsap.quickTo(tl,'rotationX',{duration:.5}),ry=gsap.quickTo(tl,'rotationY',{duration:.5});
  w.addEventListener('pointermove',e=>{const r=w.getBoundingClientRect();ry(((e.clientX-r.left)/r.width-.5)*24);rx(-((e.clientY-r.top)/r.height-.5)*24)});
  w.addEventListener('pointerleave',()=>{rx(0);ry(0)})});
act(0);

/* ---------- about: hold, drag, tilt, flip badge ---------- */
(function(){
  const sw=$('.sw2'),tilt=$('#tilt'),flip=$('#flip'),av=$('.av'),mo=$('.mo'),eyes=$$('.eye'),pus=$$('.pu'),bub=$('#bub'),chips=$$('.chips .cb');
  $('.bc').innerHTML=Array.from({length:30},()=>`<i style="width:${1+Math.floor(Math.random()*4)}px"></i>`).join('');
  const SM='0% 0% 50% 50% / 0% 0% 100% 100%',RD='50% 50% 50% 50% / 50% 50% 50% 50%';
  const M=[
   {t:'Tôi là Duy Anh, designer ở Sài Gòn. Tám năm làm thương hiệu, giao diện và chuyển động. Tôi hay bắt đầu từ một nét vẽ nguệch ngoạc trên giấy.',c:null,w:'31%',h:'15.6%',r:SM,k:0},
   {t:'Chữ viết tay, màu đậm, cà phê sữa đá và những dự án mà khách nói: làm gì cũng được. Càng ít ràng buộc, tôi càng vui.',c:'#ffd23f',w:'16%',h:'16%',r:RD,k:0},
   {t:'Mẫu thiết kế giống hệt nhau, file tên final_final_v7 và câu "làm logo to lên chút". Nhưng tôi vẫn làm, vì biết lắng nghe cũng là một kỹ năng.',c:'#3a2cff',w:'27%',h:'4.7%',r:RD,k:0},
   {t:'Figma cho giao diện, Illustrator cho nét, After Effects cho chuyển động, Blender cho 3D và một cuốn sổ chấm bi không bao giờ rời tay.',c:'#19c37d',w:'31%',h:'15.6%',r:SM,k:1},
   {t:'2018 nhận dự án freelance đầu tiên. 2020 vào studio. 2023 nhận giải thiết kế đầu tiên. 2026 mở xưởng nhỏ của riêng mình.',c:'#ff8a2b',w:'34%',h:'17%',r:SM,k:0}];
  let fl=false,vis=false,ready=false,cur=0,held=false,drag=false,sx=0,sy=0,mx=innerWidth/2,my=innerHeight/2;const ox=[0,0],oy=[0,0],cl=gsap.utils.clamp;
  gsap.set(mo,{xPercent:-50});gsap.set(tilt,{rotationX:-90,opacity:0});
  const face=m=>gsap.to(mo,{width:m.w,height:m.h,borderRadius:m.r,duration:.6,ease:'elastic.out(1,.5)'});
  const doFlip=f=>{fl=f;gsap.to(flip,{rotationY:f?180:0,duration:.8,ease:'back.out(1.4)'})};
  function mood(i){
    const m=M[cur=i];chips.forEach((c,j)=>c.classList.toggle('on',j===i));bub.textContent=m.t;
    gsap.to(av,{backgroundColor:m.c||curAcc,duration:.4});face(m);
    gsap.to(eyes[0],{scaleY:m.k?.1:1,duration:.2});
    gsap.fromTo(bub,{scale:.94,rotation:-1.5},{scale:1,rotation:0,duration:.6,ease:'back.out(3)'});
    doFlip(i===3);
  }
  chips.forEach((c,i)=>c.onclick=()=>mood(i));mood(0);
  const enter=(()=>{let d=false;return()=>{if(d)return;d=true;gsap.to(tilt,{rotationX:0,opacity:1,duration:1.3,ease:'back.out(1.6)',onComplete:()=>ready=true})}})();
  ScrollTrigger.create({trigger:'.bw',start:'top 80%',onEnter:enter,onLeave:enter});
  const hover=e=>{const r=sw.getBoundingClientRect(),nx=(e.clientX-r.left)/r.width-.5,ny=(e.clientY-r.top)/r.height-.5;
    gsap.to(tilt,{rotationY:cl(-16,16,nx*30),rotationX:cl(-10,10,-ny*18),duration:.6,ease:'power3',overwrite:'auto'});av.style.setProperty('--sx',(50+nx*160)+'%')};
  const rest=()=>{gsap.to(tilt,{rotationY:0,rotationX:0,rotationZ:0,scale:1,duration:.7,ease:'power3',overwrite:'auto'});av.style.setProperty('--sx','-30%')};
  sw.addEventListener('pointerdown',e=>{if(!ready)return;held=true;drag=false;sx=e.clientX;sy=e.clientY;sw.setPointerCapture(e.pointerId);
    gsap.to(tilt,{scale:.97,duration:.2,overwrite:'auto'});face(M[1])});
  sw.addEventListener('pointermove',e=>{if(!ready)return;
    if(held){const dx=e.clientX-sx,dy=e.clientY-sy;if(!drag&&Math.hypot(dx,dy)>6)drag=true;
      if(drag)gsap.to(tilt,{rotationZ:cl(-32,32,-dx*.16),rotationY:cl(-30,30,dx*.12),rotationX:cl(-22,22,-dy*.1),scale:1.04,duration:.25,ease:'power2.out',overwrite:'auto'})}
    else if(e.pointerType==='mouse')hover(e)});
  const release=()=>{if(!held)return;held=false;face(M[cur]);
    gsap.to(tilt,{rotationZ:0,rotationX:0,rotationY:0,scale:1,duration:1.2,ease:'back.out(1.7)',overwrite:'auto'});av.style.setProperty('--sx','-30%')};
  sw.addEventListener('pointerup',release);sw.addEventListener('pointercancel',release);
  sw.addEventListener('pointerleave',()=>{if(ready&&!held)rest()});
  sw.addEventListener('click',()=>{if(drag){drag=false;return}if(ready)doFlip(!fl)});
  addEventListener('pointermove',e=>{mx=e.clientX;my=e.clientY},{passive:true});
  new IntersectionObserver(([e])=>vis=e.isIntersecting).observe($('.bw'));
  gsap.ticker.add(()=>{if(!vis||fl)return;
    eyes.forEach((e,k)=>{const r=e.getBoundingClientRect(),dx=mx-(r.left+r.width/2),dy=my-(r.top+r.height/2),d=Math.hypot(dx,dy)||1,m=Math.min(r.width*.2,d/30);
      ox[k]+=(dx/d*m-ox[k])*.15;oy[k]+=(dy/d*m-oy[k])*.15;pus[k].style.transform=`translate(${ox[k]}px,${oy[k]}px)`})});
  (function blink(){gsap.to('.ey',{scaleY:.1,duration:.07,yoyo:true,repeat:1});gsap.delayedCall(2+Math.random()*3,blink)})();
})();

/* ---------- services: live demos ---------- */
const tabs=$$('.tab'),dms=$$('.dm');let zi=1,cur=-1,cubeOn=false,ez=1;
const EZ=[['Power4','power4.inOut'],['Elastic','elastic.out(1,.4)'],['Bounce','bounce.out'],['Back','back.inOut(3)']];
function show(i){
  if(i===cur)return;cur=i;
  tabs.forEach((t,j)=>t.classList.toggle('on',j===i));
  dms[i].style.zIndex=++zi;gsap.fromTo(dms[i],{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0% 0 0)',duration:.7,ease:'expo.out'});
  cubeOn=i===3;if(i===2)play(ez);
}
tabs.forEach((t,i)=>{t.onclick=()=>show(i);if(fine)t.onmouseenter=()=>show(i)});
/* brand */
const mk=$('#mk'),SH=[['50% 50% 50% 50%',0],['0% 0% 0% 0%',45],['50% 0% 50% 0%',0],['22% 22% 22% 22%',0],['50% 50% 0% 50%',0]],CL=['#14102b','#ffffff','#ffd23f','#3a2cff'];let si=0,ci=0;
$('#b1').onclick=()=>{si=(si+1)%SH.length;gsap.to(mk,{borderRadius:SH[si][0],rotation:SH[si][1],duration:.9,ease:'elastic.out(1,.5)'})};
$('#b2').onclick=()=>{ci=(ci+1)%CL.length;gsap.to(mk,{backgroundColor:CL[ci],duration:.4})};
$('#inb').oninput=e=>{$('#lgt').textContent=e.target.value||'…'};
/* ui */
$('#rg').oninput=e=>$('#ph').style.setProperty('--r',e.target.value+'px');
$('#dk').onclick=()=>$('#ph').classList.toggle('dk');
/* motion */
const eb=$('#eb');
EZ.forEach((e,i)=>{const b=document.createElement('button');b.className='cb';b.textContent=e[0];b.onclick=()=>play(i);eb.append(b)});
function play(i){ez=i;const e=EZ[i][1],f=gsap.parseEase(e);let d='';
  for(let k=0;k<=60;k++){const x=k/60;d+=(k?'L':'M')+(x*100).toFixed(1)+' '+(85-f(x)*70).toFixed(1)}
  $('#pth').setAttribute('d',d);$('#ez').textContent=`ease: "${e}"`;
  gsap.fromTo('#bl',{x:0},{x:()=>$('.trk').clientWidth-$('#bl').offsetWidth,duration:1.6,ease:e})}
/* cube */
const cube=$('#cube'),sc=$('#sc'),FC=['#ff3d81','#ffd23f','#ffffff','#19c37d','#ff8a2b','#cdc9ff'];
let rY=30,rX=-24,vY=.5,dr=false,lx=0,ly=0;
const paint=()=>[...cube.children].forEach((f,i)=>f.style.setProperty('--c',FC[i]));paint();
$('#cc').onclick=()=>{FC.push(FC.shift());paint()};
sc.addEventListener('pointerdown',e=>{dr=true;lx=e.clientX;ly=e.clientY;sc.setPointerCapture(e.pointerId)});
sc.addEventListener('pointermove',e=>{if(!dr)return;vY=(e.clientX-lx)*.5;rY+=vY;rX=gsap.utils.clamp(-80,80,rX-(e.clientY-ly)*.5);lx=e.clientX;ly=e.clientY});
sc.addEventListener('pointerup',()=>dr=false);sc.addEventListener('pointercancel',()=>dr=false);
gsap.ticker.add(()=>{if(!cubeOn)return;if(!dr){rY+=vY;vY+=(.5-vY)*.03}gsap.set(cube,{rotationX:rX,rotationY:rY})});
show(0);

/* ---------- process: chaos to order, pinned ---------- */
(function(){
  const N=12,TRI=[[50,4],[98,96],[2,96]],SQ=[[50,0],[100,0],[100,100],[0,100],[0,0]];
  const perim=(V,t)=>{const n=V.length,L=V.map((v,i)=>Math.hypot(V[(i+1)%n][0]-v[0],V[(i+1)%n][1]-v[1])),T=L.reduce((a,b)=>a+b);let q=t*T,i=0;while(i<n-1&&q>L[i]){q-=L[i];i++}const a=V[i],b=V[(i+1)%n],f=q/L[i];return[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]};
  const FN=[t=>[50+50*Math.sin(6.2832*t),50-50*Math.cos(6.2832*t)],t=>perim(TRI,t),t=>perim(SQ,t),t=>{const k=Math.round(t*N),r=k%2?22:50,a=6.2832*k/N;return[50+r*Math.sin(a),50-r*Math.cos(a)]}];
  const poly=fn=>'polygon('+Array.from({length:N},(_,i)=>fn(i/N).map(v=>v.toFixed(1)+'%').join(' ')).join(',')+')';
  const CP=FN.map(poly),CL=['#ff3d81','#ffd23f','#ffd23f','#ffd23f'],BG=['#14102b','#2a1fd6','#e0236b','#0b7d54'];
  const ST=[['01','Khám phá','Tôi nghe bạn kể, hỏi nhiều hơn vẽ. Hiểu người dùng trước khi chạm vào bút.',['Phỏng vấn','Nghiên cứu','Mục tiêu']],
    ['02','Phác thảo','Mười ý tưởng tệ để tìm ra một ý tưởng tốt. Giấy, bút và rất nhiều cà phê.',['Moodboard','Phác thảo','Ý tưởng']],
    ['03','Dựng','Chuyển từ giấy sang pixel, thử, sửa, rồi thử lại cho đến khi nó sống.',['Wireframe','Thiết kế','Prototype']],
    ['04','Giao','Bàn giao gọn gàng, có hướng dẫn, và đôi khi kèm một lời cảm ơn nhỏ.',['Bàn giao','Hướng dẫn','Hỗ trợ']]];
  $('.pt2').innerHTML=ST.map(s=>`<div class="st"><span class="nb d">${s[0]}</span><h3 class="d">${s[1]}</h3><p>${s[2]}</p><ul class="tg">${s[3].map(c=>`<li>${c}</li>`).join('')}</ul></div>`).join('');
  const sts=$$('.st'),s1=$('.s1'),s2=$('.s2'),sh=$('.shw'),stg=$('#stg'),dots=$$('.dots i'),sec=$('#process');
  const SC=['#ffffff','#ffd23f','#ff3d81','#19c37d'];
  stg.insertAdjacentHTML('beforeend',Array.from({length:8},(_,i)=>`<i class="sat t${i%4+1}" style="--c:${SC[i%4]}"></i>`).join(''));
  const sats=$$('.sat');
  const SQP=[[-.36,-.36],[0,-.4],[.36,-.36],[.4,0],[.36,.36],[0,.4],[-.36,.36],[-.4,0]];
  const A=[
    i=>{const a=(i*2.399)%6.283,r=.3+((i*37)%7)/7*.17;return[Math.cos(a)*r,Math.sin(a)*r,(i*53)%360,.7]},
    i=>{const a=i*.95,r=.2+i*.04;return[Math.cos(a)*r,Math.sin(a)*r,i*40,.9]},
    i=>[SQP[i][0],SQP[i][1],0,1],
    i=>{const a=i*.7854+.39;return[Math.cos(a)*.72,Math.sin(a)*.72,360+i*30,1.35]}];
  const to=k=>({x:i=>A[k](i)[0]*stg.clientWidth,y:i=>A[k](i)[1]*stg.clientWidth,rotation:i=>A[k](i)[2],scale:i=>A[k](i)[3]});
  gsap.set(sats,to(0));
  gsap.set(sts,{opacity:0});gsap.set(sts[0],{opacity:1});gsap.set(sec,{backgroundColor:BG[0]});
  gsap.set([s1,s2],{clipPath:CP[0]});gsap.set(s1,{backgroundColor:CL[0]});
  const tl=gsap.timeline({defaults:{ease:'none'},scrollTrigger:{trigger:sec,pin:true,scrub:.6,start:'top top',end:'+=350%',invalidateOnRefresh:true,
    onUpdate:s=>{const k=Math.min(3,Math.round(s.progress*3));dots.forEach((d,j)=>d.classList.toggle('on',j===k))}}});
  for(let i=0;i<3;i++){const T=i+.7;
    tl.to(sec,{backgroundColor:BG[i+1],duration:.7},T)
      .to(s1,{clipPath:CP[i+1],backgroundColor:CL[i+1],duration:.7},T).to(s2,{clipPath:CP[i+1],duration:.7},T)
      .to(sh,{rotation:'+=140',duration:.7},T).to(sh,{scale:1.22,duration:.35,ease:'power2.out'},T).to(sh,{scale:1,duration:.35,ease:'power2.in'},T+.35)
      .to(sats,{...to(i+1),duration:.7,ease:'power2.inOut',stagger:.04},T)
      .to(sts[i],{opacity:0,y:-30,duration:.3},T).fromTo(sts[i+1],{opacity:0,y:30},{opacity:1,y:0,duration:.3},T+.3)
      .fromTo(sts[i+1].querySelectorAll('li'),{y:24,opacity:0},{y:0,opacity:1,stagger:.06,duration:.25},T+.4)}
  tl.to('.dots',{duration:.7},3.4);dots[0].classList.add('on');
  if(fine)sec.addEventListener('pointermove',e=>{const nx=e.clientX/innerWidth-.5,ny=e.clientY/innerHeight-.5;
    gsap.to(stg,{rotationY:nx*16,rotationX:-ny*12,transformPerspective:900,duration:.8,ease:'power3',overwrite:'auto'})});
})();

/* ---------- poster generator ---------- */
(function(){
  const cv=$('#pz'),x=cv.getContext('2d'),W=800,H=1000;cv.width=W;cv.height=H;
  const IN='#14102b',PK='#ff3d81',BL='#3a2cff',YL='#ffd23f',GR='#19c37d',OR='#ff8a2b',LV='#e4e1ff';
  let st=0,seed=7,raf=0;
  const rng=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  const F=z=>`700 ${z}px 'Space Grotesk',sans-serif`,pick=(R,a)=>a[Math.floor(R()*a.length)];
  const fit=(t,w,z)=>{x.font=F(z);while(x.measureText(t).width>w&&z>20){z-=4;x.font=F(z)}return z};
  const ink=()=>{x.lineWidth=6;x.strokeStyle=IN};
  const circ=(cx,cy,r,c)=>{x.beginPath();x.arc(cx,cy,r,0,7);x.fillStyle=c;x.fill();ink();x.stroke()};
  const poly=(p,c)=>{x.beginPath();p.forEach((q,i)=>i?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1]));x.closePath();x.fillStyle=c;x.fill();ink();x.stroke()};
  const rect=(a,b,w,h,c,r=0)=>{x.save();x.translate(a+w/2,b+h/2);x.rotate(r);x.fillStyle=c;x.fillRect(-w/2,-h/2,w,h);ink();x.strokeRect(-w/2,-h/2,w,h);x.restore()};
  const ST=[
   (R,T)=>{x.fillStyle=pick(R,[LV,YL,'#fff']);x.fillRect(0,0,W,H);const C=[PK,BL,YL,GR,OR,IN];
    for(let i=0;i<4;i++){const k=Math.floor(R()*4),cx=R()*W,cy=R()*H*.65,s=140+R()*160,c=pick(R,C);
      if(k==0)circ(cx,cy,s/2,c);else if(k==1)rect(cx-s/2,cy-s/2,s,s,c,R()*1.2);else if(k==2)poly([[cx,cy-s/2],[cx+s/2,cy+s/2],[cx-s/2,cy+s/2]],c);
      else{x.beginPath();x.arc(cx,cy,s/2,Math.PI,0);x.closePath();x.fillStyle=c;x.fill();ink();x.stroke()}}
    for(let i=0;i<6;i++)rect(60+i*30,H-330,16,170,IN);
    const z=fit(T,W-120,180);x.font=F(z);x.fillStyle=IN;x.fillText(T,60,H-60)},
   (R,T)=>{x.fillStyle='#f4f4f0';x.fillRect(0,0,W,H);x.strokeStyle=IN;x.lineWidth=2;
    for(let i=1;i<4;i++){x.beginPath();x.moveTo(i*W/4,0);x.lineTo(i*W/4,H);x.stroke()}
    circ(W*.7,H*.62,230+R()*60,pick(R,[PK,BL,OR]));
    let y=130;T.split(' ').forEach(w=>{const z=fit(w,W-120,190);x.font=F(z);x.fillStyle=IN;x.fillText(w,60,y);y+=z*.95});
    for(let i=0;i<6;i++)rect(W*.5+8,H-190+i*26,(.3+R()*.55)*W*.4,10,IN);
    x.font=F(26);x.fillStyle=IN;x.fillText('Duy Anh® — Poster',60,H-50)},
   (R,T)=>{x.fillStyle=IN;x.fillRect(0,0,W,H);rect(80+R()*120,200+R()*200,420,520,pick(R,[PK,YL,GR]),R()*.2-.1);
    const z=fit(T,W-100,230);x.font=F(z);x.lineWidth=5;x.strokeStyle='#fff';
    for(let i=0;i<3;i++)x.strokeText(T,50,260+i*z*.8);x.fillStyle='#fff';x.fillText(T,50,260+3*z*.8);
    rect(-40,H-260,W+80,90,YL,-.06);x.fillStyle=IN;x.font=F(40);x.save();x.translate(0,H-210);x.rotate(-.06);x.fillText('ĐANG LÀM ★ ĐANG LÀM ★ ĐANG LÀM ★',20,10);x.restore()},
   (R,T)=>{x.fillStyle=pick(R,[YL,PK,'#fff']);x.fillRect(0,0,W,H);const cx=R()*W,cy=R()*H*.6+150;x.fillStyle=BL;
    for(let gx=20;gx<W;gx+=44)for(let gy=20;gy<H;gy+=44){const r=Math.max(0,16-Math.hypot(gx-cx,gy-cy)/28);if(r>1){x.beginPath();x.arc(gx,gy,r,0,7);x.fill()}}
    const p=[];for(let i=0;i<32;i++){const a=i/32*6.2832,r=i%2?250:340;p.push([W/2+Math.cos(a)*r,H*.45+Math.sin(a)*r])}poly(p,pick(R,[PK,YL,GR]));
    const z=fit(T,W-160,200);x.font=F(z);x.textAlign='center';x.fillStyle=IN;x.fillText(T,W/2+9,H*.45+z*.3+9);x.fillStyle='#fff';x.fillText(T,W/2,H*.45+z*.3);x.textAlign='left';
    x.font=F(30);x.fillStyle=IN;x.fillText('Duy Anh® ★ Poster № '+(seed%100),50,H-50)}];
  function draw(){x.setTransform(1,0,0,1,0,0);x.lineJoin='round';x.textAlign='left';x.textBaseline='alphabetic';ST[st](rng(seed*9973+st),($('#pt').value.trim()||'THIẾT KẾ').toUpperCase())}
  const pop=()=>gsap.fromTo(cv,{rotation:-3,scale:.95},{rotation:0,scale:1,duration:.6,ease:'back.out(3)'});
  const chips=$$('.pst .cb');chips.forEach((b,i)=>b.onclick=()=>{st=i;chips.forEach((c,j)=>c.classList.toggle('on',j===i));draw();pop()});
  $('#pt').oninput=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(draw)};
  $('#pnew').onclick=()=>{seed=Math.floor(Math.random()*9999);draw();pop()};
  $('#pdl').onclick=()=>cv.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='poster-an-nhien.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)});
  draw();if(document.fonts)document.fonts.load("700 100px 'Space Grotesk'").then(draw);
})();

/* ---------- kerning game ---------- */
(function(){
  const WD='DESIGN',kt=$('#kt'),kw=$('.kw');
  kt.innerHTML=[...WD].map((c,i)=>`<span class="${i&&i<WD.length-1?'':'fx'}">${c}</span>`).join('');
  const L=$$('#kt span'),mv=L.slice(1,-1);let won=false;
  const fs=()=>parseFloat(getComputedStyle(kt).fontSize);
  function score(){const r=L.map(l=>l.getBoundingClientRect()),g=[];for(let i=0;i<r.length-1;i++)g.push(r[i+1].left-r[i].right);
    const m=g.reduce((a,b)=>a+b)/g.length,sd=Math.sqrt(g.reduce((a,b)=>a+(b-m)**2,0)/g.length);return Math.round(100*Math.exp(-sd/(fs()*.35)))}
  function upd(){const v=score();$('#ksc').textContent=v+'%';
    $('#kmsg').textContent=v>=90?'Mắt designer chuẩn chỉnh!':v>=75?'Gần được rồi, chỉnh thêm chút.':v>=50?'Cũng ổn, nhưng còn lệch.':'Khoảng cách đang loạn. Kéo thử xem.';
    if(v>=90&&!won){won=true;boom()}if(v<85)won=false}
  function boom(){const C=['#ff3d81','#ffd23f','#3a2cff','#19c37d','#14102b'];
    for(let i=0;i<26;i++){const p=document.createElement('i');p.style.cssText=`position:absolute;left:50%;top:50%;width:${8+Math.random()*12}px;height:${8+Math.random()*12}px;background:${C[i%5]};border-radius:${i%2?'50%':'2px'};pointer-events:none`;kw.append(p);
      gsap.to(p,{x:(Math.random()-.5)*kw.clientWidth,y:(Math.random()-.5)*kw.clientHeight*1.6,rotation:Math.random()*720,opacity:0,duration:1.2+Math.random(),ease:'power3.out',onComplete:()=>p.remove()})}}
  const shuffle=()=>{won=false;mv.forEach((l,i)=>gsap.to(l,{x:gsap.utils.random(-.32,.32)*fs(),duration:.6,ease:'back.out(2)',onComplete:i===mv.length-1?upd:null}))};
  mv.forEach(l=>{let sx=0,x0=0,on=false;
    l.addEventListener('pointerdown',e=>{on=true;sx=e.clientX;x0=gsap.getProperty(l,'x');l.setPointerCapture(e.pointerId);gsap.to(l,{scale:1.12,duration:.2})});
    l.addEventListener('pointermove',e=>{if(!on)return;gsap.set(l,{x:gsap.utils.clamp(-.7*fs(),.7*fs(),x0+e.clientX-sx)});upd()});
    const up=()=>{on=false;gsap.to(l,{scale:1,duration:.3})};l.addEventListener('pointerup',up);l.addEventListener('pointercancel',up)});
  $('#kshuf').onclick=shuffle;
  $('#kfix').onclick=()=>gsap.to(mv,{x:0,duration:.9,ease:'elastic.out(1,.5)',onUpdate:upd});
  mv.forEach(l=>gsap.set(l,{x:gsap.utils.random(-.32,.32)*fs()}));upd();
})();

/* ---------- desk: physics stickers ---------- */
(function(){
  const {Engine,Bodies,Composite,Constraint,Query,Body}=Matter;
  const eng=Engine.create(),cvs=$('#desk'),ctx=cvs.getContext('2d');
  let W=0,H=0,dpr=1,walls=[],st=[],grab=null,downHit=false,moved=false,vis=false;
  const WORDS=['Typography','Motion','Brand','UI/UX','3D','Ý tưởng','Màu sắc','Layout','Icon','Poster','Grid','Kerning','duyanh.dev'];
  const COL=[['acc','#14102b'],['#3a2cff','#fff'],['#ffd23f','#14102b'],['#ffffff','#14102b'],['#19c37d','#14102b']];
  const u=()=>Math.max(30,Math.min(W/13,56));
  function size(){
    dpr=Math.min(devicePixelRatio,2);W=cvs.clientWidth;H=cvs.clientHeight;cvs.width=W*dpr;cvs.height=H*dpr;
    Composite.remove(eng.world,walls);const o={isStatic:true};
    walls=[Bodies.rectangle(W/2,H+50,W*3,100,o),Bodies.rectangle(W/2,-50,W*3,100,o),Bodies.rectangle(-50,H/2,100,H*4,o),Bodies.rectangle(W+50,H/2,100,H*4,o)];
    Composite.add(eng.world,walls);
    st.forEach(b=>{if(b.position.x>W-20)Body.setPosition(b,{x:W-40,y:b.position.y})});
  }
  new ResizeObserver(size).observe(cvs);size();
  function spawn(x=40+Math.random()*(W-80),y=70){
    const k=Math.random(),c=COL[Math.floor(Math.random()*COL.length)],U=u(),o={restitution:.55,friction:.3};let b,lab='';
    if(k<.5){lab=WORDS[Math.floor(Math.random()*WORDS.length)];ctx.font=`700 ${U*.5}px 'Space Grotesk',sans-serif`;b=Bodies.rectangle(x,y,ctx.measureText(lab).width+U*.9,U*1.05,{...o,chamfer:{radius:U*.5,quality:10}});b.k='p'}
    else if(k<.72){b=Bodies.circle(x,y,U*.75,o);b.k='c'}
    else if(k<.87){b=Bodies.polygon(x,y,3,U*.95,o);b.k='t'}
    else{b=Bodies.rectangle(x,y,U*1.4,U*1.4,{...o,chamfer:{radius:7}});b.k='s'}
    b.ui={c:c[0],t:c[1],lab,f:U*.5};Body.setAngle(b,Math.random()*3);Body.setVelocity(b,{x:(Math.random()-.5)*8,y:0});
    Composite.add(eng.world,b);st.push(b);if(st.length>45)Composite.remove(eng.world,st.shift());
  }
  function draw(){
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);ctx.lineWidth=3;ctx.lineJoin='round';ctx.strokeStyle='#14102b';
    st.forEach(b=>{
      ctx.beginPath();
      if(b.k==='c')ctx.arc(b.position.x,b.position.y,b.circleRadius,0,7);
      else{b.vertices.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath()}
      ctx.fillStyle=b.ui.c==='acc'?curAcc:b.ui.c;ctx.fill();ctx.stroke();
      if(b.ui.lab){ctx.save();ctx.translate(b.position.x,b.position.y);ctx.rotate(b.angle);ctx.font=`700 ${b.ui.f}px 'Space Grotesk',sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=b.ui.t;ctx.fillText(b.ui.lab,0,1);ctx.restore()}
    });
  }
  (function L(){requestAnimationFrame(L);if(!vis)return;Engine.update(eng,1000/60);draw()})();
  new IntersectionObserver(([e])=>vis=e.isIntersecting).observe(cvs);
  ScrollTrigger.create({trigger:cvs,start:'top 70%',once:true,onEnter(){for(let i=0;i<10;i++)setTimeout(()=>spawn(),i*170)}});
  const pos=e=>{const r=cvs.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
  cvs.addEventListener('pointerdown',e=>{
    moved=false;const p=pos(e),h=Query.point(st,p)[0];downHit=!!h;
    if(h){grab=Constraint.create({pointA:p,bodyB:h,pointB:{x:p.x-h.position.x,y:p.y-h.position.y},stiffness:.18,damping:.1,length:0});Composite.add(eng.world,grab);cvs.setPointerCapture(e.pointerId);cvs.style.cursor='grabbing'}
  });
  cvs.addEventListener('touchstart',e=>{if(downHit)e.preventDefault()},{passive:false});
  cvs.addEventListener('pointermove',e=>{moved=true;if(grab)grab.pointA=pos(e)});
  const up=()=>{if(grab){Composite.remove(eng.world,grab);grab=null}cvs.style.cursor='grab'};
  cvs.addEventListener('pointerup',up);cvs.addEventListener('pointercancel',up);
  cvs.addEventListener('click',e=>{if(!downHit&&!moved){const p=pos(e);spawn(p.x,p.y)}});
  const kick=s=>st.forEach(b=>{Body.setVelocity(b,{x:(Math.random()-.5)*s,y:(Math.random()-.5)*s});Body.setAngularVelocity(b,(Math.random()-.5)*.3)});
  const A={add:()=>spawn(),shake:()=>kick(26),g1:()=>eng.gravity.y=1,g2:()=>eng.gravity.y=-1,g0:()=>{eng.gravity.y=0;kick(8)},clr:()=>{st.forEach(b=>Composite.remove(eng.world,b));st=[]}};
  $$('[data-a]').forEach(b=>b.onclick=()=>A[b.dataset.a]());
  $$('.sw').forEach(s=>s.onclick=()=>{setAcc(s.dataset.c);gsap.fromTo(s,{scale:.5},{scale:1,duration:.9,ease:'elastic.out(1,.4)'})});
})();

/* contact */
gsap.from('.ct h2,.ct .big',{y:80,opacity:0,duration:1.1,stagger:.15,ease:'expo.out',scrollTrigger:{trigger:'.ct',start:'top 70%'}});
const tick=()=>$('#clk').textContent=new Date().toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'});
tick();setInterval(tick,30000);
addEventListener('load',()=>ScrollTrigger.refresh());
