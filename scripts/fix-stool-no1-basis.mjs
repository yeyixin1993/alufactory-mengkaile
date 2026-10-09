import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Euler, Quaternion, Vector3 } from 'three';
// Confirmed Angle bracket S30 source family: native +X -> source -Z,
// native +Y -> source +Y. Source seating intersection is (0,-14.265,15).
// This adapts imported instances; native No.1 catalog geometry stays unchanged.
const [sourcePath, targetPath, outputPath] = process.argv.slice(2);
if (!outputPath) throw Error('Usage: node scripts/fix-stool-no1-basis.mjs original.json converted.json output.json');
const original=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const target=JSON.parse(fs.readFileSync(targetPath,'utf8'));
const sources=new Map(original.items.map(i=>[i.id,i]));
const basis=new Quaternion().setFromEuler(new Euler(0,Math.PI/2,0,'XYZ'));
let count=0;
for(const item of target.items){
 const source=sources.get(item.id);
 if(source?.sourceMesh?.source?.semanticType!=='angle_bracket'||source.name!=='Angle bracket S30')continue;
 assert.equal(item.kind,'connector');assert.equal(item.accessoryProfileSize,'3030');
 const b=source.sourceMesh.boundsMm;
 assert.deepEqual(b,{min:[-15,-15.735,-15],max:[15,15.735,15]},'Unexpected source geometry; recalibrate first');
 const q=new Quaternion().setFromEuler(new Euler(...source.rotation.map(v=>v*Math.PI/180),'XYZ'));
 const origin=new Vector3(...source.position);
 const offset=new Vector3(0,-14.265,15).applyQuaternion(q);
 const corrected=q.clone().multiply(basis);
 const rotation=new Euler().setFromQuaternion(corrected,'XYZ');
 const clean=n=>Math.abs(n)<1e-8?0:Math.round(n*1e6)/1e6;
 item.position=origin.clone().add(offset).toArray().map(clean);
 item.rotation=[rotation.x,rotation.y,rotation.z].map(n=>clean(n*180/Math.PI));
 item.remark='用户确认：3030 1号角码；已从Angle bracket S30源坐标转换至原生No.1安装基准。安装与承载仍待复核。';
 item.sourceBasisConversion={version:1,sourceName:source.name,sourcePosition:source.position,sourceRotation:source.rotation,localOffsetMm:[0,-14.265,15],localRotationDeg:[0,90,0]};
 // Verify actual saved transform agrees with both mounting planes and full-width axis.
 const saved=new Quaternion().setFromEuler(new Euler(...item.rotation.map(v=>v*Math.PI/180),'XYZ'));
 for(const [native,expected] of [[[1,0,0],[0,0,-1]],[[0,1,0],[0,1,0]],[[0,0,1],[1,0,0]]]){
  assert.ok(new Vector3(...native).applyQuaternion(saved).distanceTo(new Vector3(...expected).applyQuaternion(q))<1e-7);
 }
 assert.ok(new Vector3(...item.position).distanceTo(origin.add(offset))<1e-5);
 count++;
}
assert.equal(count,16);
fs.writeFileSync(outputPath,JSON.stringify(target));
console.log(`Corrected and verified ${count} No.1 bracket transforms.`);
