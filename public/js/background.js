import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js').then(({Scene,PerspectiveCamera,WebGLRenderer,Group,Mesh,MeshPhysicalMaterial,SphereGeometry,TorusGeometry,AmbientLight,DirectionalLight,Vector2,Clock})=>{
  const canvas=document.createElement('canvas');canvas.className='scene-bg';canvas.setAttribute('aria-hidden','true');document.body.prepend(canvas);
  const scene=new Scene(), camera=new PerspectiveCamera(38,innerWidth/innerHeight,.1,100);camera.position.set(0,0,15);
  const renderer=new WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.setClearColor(0x000000,0);
  scene.add(new AmbientLight(0xffffff,2));const light=new DirectionalLight(0xffffff,3);light.position.set(-4,6,9);scene.add(light);
  const group=new Group();scene.add(group);const mat=new MeshPhysicalMaterial({color:0xf1c343,roughness:.28,metalness:.08,transparent:true,opacity:.7,clearcoat:.75});
  const orb=new Mesh(new SphereGeometry(2.2,48,48),mat);orb.position.set(5,1,-3);group.add(orb);
  const ring=new Mesh(new TorusGeometry(2.7,.035,12,120),new MeshPhysicalMaterial({color:0xd99d18,roughness:.4,transparent:true,opacity:.45}));ring.position.set(5,1,-3);ring.rotation.set(.6,.2,-.4);group.add(ring);
  const orb2=new Mesh(new SphereGeometry(1.1,40,40),new MeshPhysicalMaterial({color:0xf4e4bb,roughness:.35,metalness:.05,transparent:true,opacity:.62}));orb2.position.set(-6,-2,-5);group.add(orb2);
  const pointer=new Vector2();addEventListener('pointermove',e=>{pointer.x=e.clientX/innerWidth-.5;pointer.y=e.clientY/innerHeight-.5},{passive:true});
  const clock=new Clock();function draw(){const t=clock.getElapsedTime();group.rotation.y=.08*Math.sin(t*.22)+pointer.x*.025;group.rotation.x=.035*Math.sin(t*.3)-pointer.y*.02;orb.position.y=1+Math.sin(t*.45)*.14;renderer.render(scene,camera);requestAnimationFrame(draw)}
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)},{passive:true});draw();
}).catch(()=>{});