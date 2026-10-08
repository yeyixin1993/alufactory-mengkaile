import {useAIText} from '../utils/aiLocale';
import React,{useEffect,useRef,useState} from 'react';
import {RotateCcw} from 'lucide-react';
import {ProfileConfig} from '../types';
export default function AIProfile3D({config}:{config:ProfileConfig}) {
 const {language,tr}=useAIText();
 const [transparent,setTransparent]=useState(false);const transparencyRef=useRef(false);const applyTransparency=useRef<((value:boolean)=>void)|null>(null);
 useEffect(()=>{transparencyRef.current=transparent;applyTransparency.current?.(transparent);},[transparent]);
 const host=useRef<HTMLDivElement>(null);const [error,setError]=useState('');const orbit=useRef<any>(null);
 useEffect(()=>{let disposed=false;let cleanup=()=>{};
  Promise.all([import('three'),import('three/addons/controls/OrbitControls.js'),import('./DIYDesigner')]).then(([T,{OrbitControls},{createChatProfilePreview}])=>{
   if(disposed||!host.current)return;
   const element=host.current;const scene=new T.Scene();scene.background=new T.Color('#f1f5f9');
   const camera=new T.PerspectiveCamera(40,1,.001,1000);const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));element.appendChild(renderer.domElement);
   const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enabled=true;controls.enableZoom=true;orbit.current=controls;
   scene.add(new T.HemisphereLight(0xffffff,0x64748b,2));const light=new T.DirectionalLight(0xffffff,2);light.position.set(4,6,8);scene.add(light);
   const profile=new T.Group();scene.add(profile);
   const disposeObject=(object:any)=>object.traverse((o:any)=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach((m:any)=>m.dispose());});
   let body=createChatProfilePreview(config,transparencyRef.current);profile.add(body);
   applyTransparency.current=(value)=>{profile.remove(body);disposeObject(body);body=createChatProfilePreview(config,value);profile.add(body);};
   // The shared designer has straight extrusions. Overlay the P2-confirmed
   // cutting planes in chat rather than silently displaying a finished square end.
   const section=(config.variantId||'2020').match(/^(\d{2})(\d{2,3})/);
   const width=Number(section?.[1]||20)/100,height=Number(section?.[2]||20)/100;
   for(const end of ['left','right'] as const){
    const cut=config.miterCut?.[end];if(!cut?.enabled)continue;
    const span=cut.side==='AC'?width:height, depth=cut.side==='AC'?height:width;
    const sign=cut.direction==='up'?1:-1, endSign=end==='left'?-1:1;
    const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([v,d])=>{
      const transverse=v*span/2, x=endSign*(config.length/200-(span/2+sign*transverse));
      return cut.side==='AC'?new T.Vector3(x,d*depth/2,transverse):new T.Vector3(x,transverse,d*depth/2);
    });
    const geometry=new T.BufferGeometry().setFromPoints([points[0],points[1],points[2],points[0],points[2],points[3]]);geometry.computeVertexNormals();
    const plane=new T.Mesh(geometry,new T.MeshBasicMaterial({color:0xf59e0b,side:T.DoubleSide,transparent:true,opacity:.65,depthTest:false}));plane.renderOrder=60;profile.add(plane);
   }
   const bounds=new T.Box3().setFromObject(profile);const center=bounds.getCenter(new T.Vector3());
   const direction=new T.Vector3(.35,.5,1).normalize();
   camera.position.copy(center).add(direction);camera.lookAt(center);
   const right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion);
   const up=new T.Vector3(0,1,0).applyQuaternion(camera.quaternion);
   const fit=()=>{
    const tan=Math.tan(T.MathUtils.degToRad(camera.fov/2));let distance=0;
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
     const point=new T.Vector3(x,y,z).sub(center);
     distance=Math.max(distance,point.dot(direction)+Math.max(Math.abs(point.dot(right))/(tan*camera.aspect),Math.abs(point.dot(up))/tan));
    }
    distance=Math.max(.1,distance*1.35);
    camera.position.copy(center).addScaledVector(direction,distance);controls.target.copy(center);
    controls.minDistance=distance*.08;controls.maxDistance=distance*6;controls.update();controls.saveState();
   };
   let firstSize=true;
   const resize=()=>{const w=Math.max(1,element.clientWidth),h=Math.max(1,element.clientHeight);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(firstSize){fit();firstSize=false;}};
   resize();const observer=new ResizeObserver(resize);observer.observe(element);
   let frame=0;const draw=()=>{controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(draw);};draw();
   cleanup=()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();orbit.current=null;applyTransparency.current=null;profile.traverse((o:any)=>{o.geometry?.dispose();if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach((m:any)=>m.dispose());}});renderer.dispose();renderer.domElement.remove();};
  }).catch(()=>setError(tr("3D 预览暂不可用，请先核对下方 ABCD 图和孔位明细。")));
  return()=>{disposed=true;cleanup();};
 },[config]);
 return <div className="ai-3d-preview">
  <div ref={host} className="ai-3d-canvas" style={{touchAction:'none',cursor:'grab'}} aria-label={tr("型材三维预览")}/>
  <div className="ai-3d-appearance" role="group" aria-label={tr("型材显示方式")}>
   <button type="button" aria-pressed={!transparent} onClick={()=>setTransparent(false)}>{tr("不透视")}</button>
   <button type="button" aria-pressed={transparent} onClick={()=>setTransparent(true)}>{tr("透视")}</button>
  </div>
  <div className="ai-3d-tools">
   <button type="button" className="ai-3d-reset" onClick={()=>orbit.current?.reset()} title={tr("恢复初始角度和大小")}><RotateCcw size={15}/>{tr("重置视角")}</button>
  </div>
  <p className="ai-3d-help">{tr("框内拖动旋转，滚轮缩放；手机单指旋转、双指缩放。移到框外可滚动聊天。")}</p>
  {error&&<p role="alert">{error}</p>}
  {(config.miterCut?.left.enabled||config.miterCut?.right.enabled)&&<small>{tr("橙色为斜切平面示意，请同时核对二维图。")}</small>}
 </div>;
}
