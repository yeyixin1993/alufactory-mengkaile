import fs from 'node:fs/promises';
import path from 'node:path';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

// Run with the bundled artifact-tool runtime after npm run catalog:html.
const root = process.env.CATALOG_REPO || process.cwd();
const out = path.join(root, 'outputs/catalog-2026');
const qa = '/private/tmp/mengkaile-workbooks';
const { profiles, accessories, boards: b } = JSON.parse(await fs.readFile(path.join(root, '.catalog-export/prices.json'), 'utf8'));
const original = JSON.parse(await fs.readFile('/private/tmp/mengkaile-source-workbooks.json', 'utf8'));
const ink='#173D38', muted='#53645F', pale='#F0F4EB', font='Arial';
const priceFormat='"¥"#,##0.00"  "';
const ranges = new Map();
const col = n => String.fromCharCode(65+n);

function table(book,name,title,headers,rows,widths,numeric=[]) {
 const s=book.worksheets.add(name); s.showGridLines=false; s.tabColor=ink;
 const last=rows.length+5, end=col(headers.length-1);
 s.getRange(`A1:${end}${last+1}`).format.font={name:font,size:11,color:ink};
 s.getRange(`A1:${end}${last+1}`).format.verticalAlignment='center';
 s.getRange('A2').values=[[title]]; s.getRange('A2').format.font={name:font,size:16,bold:true,color:ink};
 s.getRange('2:2').format.rowHeight=30;
 s.getRange('A3').values=[['萌开了家居 · 2026.09 · 人民币报价']]; s.getRange('A3').format.font={name:font,size:10,color:muted};
 s.getRange(`A5:${end}5`).values=[headers];
 s.getRange(`A5:${end}5`).format={fill:ink,font:{name:font,size:11,bold:true,color:'#FFFFFF'},horizontalAlignment:'center',verticalAlignment:'center',wrapText:true,rowHeight:36};
 s.getRange(`A6:${end}${last}`).values=rows;
 s.getRange(`A6:${end}${last}`).format.rowHeight=27;
 for(let r=6;r<=last;r++) if(r%2===0) s.getRange(`A${r}:${end}${r}`).format.fill=pale;
 widths.forEach((w,i)=>s.getRange(`${col(i)}:${col(i)}`).format.columnWidth=w);
 numeric.forEach(i=>{s.getRange(`${col(i)}6:${col(i)}${last}`).format.numberFormat=priceFormat;s.getRange(`${col(i)}6:${col(i)}${last}`).format.horizontalAlignment='right';});
 s.freezePanes.freezeRows(5); ranges.set(name,{last,end}); return s;
}
function notes(s,start,texts){texts.forEach((text,i)=>{s.getRange(`A${start+i}`).values=[[text]];s.getRange(`A${start+i}`).format.font={name:font,size:10,color:muted};});ranges.get(s.name).last=start+texts.length-1;}

const boardBook=Workbook.create();
const standard=[];
for(const [label,map] of [['铝板',b.ALUMINUM_PLATE_PRICE_PER_SQM],['铝合金洞洞板',b.PEGBOARD_PRICE_PER_SQM]])for(const t of [2,5])standard.push([label,t,'普通 / VIP',map[t],'元 / ㎡','定制尺寸']);
for(const [id,label] of [['marine_bbb_plain','BBB 素板原色'],['marine_bbb_uv_film','BBB 两面UV清漆+覆膜原色']])for(const t of [12,18])standard.push([label,t,'所有账户',b.MARINE_BOARD_SPEC_PRICE_PER_SQM[id][t],'元 / ㎡','彩色另加100元 / ㎡']);
const st=table(boardBook,'板材零售价','板材零售价格',['产品','厚度 mm','适用账户','单价','计价单位','选购说明'],standard,[37,12,18,15,15,30],[3]);
st.getRange('B6:C13').format.horizontalAlignment='center';
notes(st,16,['每块最低计费 0.2㎡。单块金额 = ROUND(MAX(宽×高÷1000000, 0.2)×单价, 1)，再乘数量。','宽、高单位为 mm。海洋板当前仅提供12mm、18mm；彩色在原色单价上加100元 / ㎡。','铝板 / 洞洞板普通与VIP仅开放2mm、5mm。网站VIP+账户可选1–5mm，见VIP+页。','来源：https://mengkaile.top/#/product/p5、p1、p6；线上版本核对日期 2026-09-08。','原表有关切割损耗、税运、开孔及起订量的说明保留在历史参考页，下单前请确认。']);
const vipRows=[];for(const [label,map] of [['铝板',b.VIP_PLUS_ALUMINUM_PLATE_PRICE_PER_SQM],['铝合金洞洞板',b.VIP_PLUS_PEGBOARD_PRICE_PER_SQM]])for(const t of [1,2,3,4,5])vipRows.push([label,t,'VIP+',map[t],'元 / ㎡','需网站VIP+账户资格']);
const vs=table(boardBook,'板材VIP+','板材 VIP+ 价格',['产品','厚度 mm','账户','单价','计价单位','选购说明'],vipRows,[28,12,14,16,15,38],[3]);
vs.getRange('B6:C15').format.horizontalAlignment='center';
notes(vs,18,['原表“大货”费率与网站VIP+费率一致；网站按会员资格开放，不能仅凭采购量套用。','海洋板所有账户同价，见板材零售价页。VIP+铝框门板材为420元 / ㎡，铰链另计。','来源：https://mengkaile.top/#/product/p5、p1；核对日期 2026-09-08。']);
const histBoard=[];for(const [sheet,rows] of Object.entries(original['萌开了板子价格计算.xlsx']))for(const row of rows.slice(1))if(row[0])histBoard.push([sheet,row[0],row[1],row[2],row[3]]);
const hb=table(boardBook,'历史参考','原表历史参考（不作为当前报价）',['原表分类','规格','原价格','原计价单位','原说明'],histBoard,[27,13,15,18,67],[2]);
hb.tabColor='#A28B55';hb.getRange(`E6:E${histBoard.length+5}`).format.wrapText=true;hb.getRange(`6:${histBoard.length+5}`).format.rowHeight=42;
notes(hb,histBoard.length+8,['本页完整保留原表记录。6/9/15mm海洋板及整张板价未被网站当前报价覆盖，请联系确认。','原零售1/3/4mm铝板、洞洞板当前不可选；原大货起订量不是网站VIP+资格规则。','来源：用户提供的《萌开了板子价格计算.xlsx》。当前价格请查前两页及网站。']);

const profileBook=Workbook.create();
const retail=table(profileBook,'型材零售价','铝型材零售价格',['型号','壁厚 mm','氧化银白','彩色截面本色','彩色截面同色'],profiles.map(p=>[p.name,p.wallThickness,p.price.oxidized,p.price.electrophoretic,p.price.powder]),[31,14,19,22,22],[2,3,4]);
retail.getRange('B6:B30').format.numberFormat='0.0';
notes(retail,33,['单位：元 / 米。材料金额 = 长度mm÷1000×米价；定制长度大于20mm，最长3000mm。','长度≤100mm每根加收5元危险加工费。打孔、攻丝、斜切等加工另计，税运下单确认。','N1/N2/N3/N4分别为一/二/三/四面封边；N2对边指相对两面封边。','通孔1元 / 孔；沉头、螺纹、口哨孔1.8元 / 孔；攻丝1.5元 / 端部孔口；斜切1元 / 端。','来源：https://mengkaile.top/#/product/p2；线上版本核对日期 2026-09-08。']);
const member=table(profileBook,'型材会员价','铝型材会员价格',['型号','VIP银白','VIP彩色截面本色','VIP彩色截面同色','VIP+银白','VIP+彩色截面本色','VIP+彩色截面同色'],profiles.map(p=>[p.name,null,null,null,null,null,null]),[30,15,22,22,15,23,23],[1,2,3,4,5,6]);
member.getRange('A33:B34').values=[['VIP每米优惠',2],['VIP+每米优惠',4]];
member.getRange('B33:B34').format.numberFormat=priceFormat;
for(let i=0;i<25;i++){const r=i+6;member.getRange(`B${r}:G${r}`).formulas=[['C','D','E'].map(c=>`='型材零售价'!${c}${r}-$B$33`).concat(['C','D','E'].map(c=>`='型材零售价'!${c}${r}-$B$34`))];}
notes(member,36,['单位：元 / 米。VIP零售价减2元，VIP+减4元；会员优惠只作用于材料米价。','会员资格与颜色/截面可选组合以网站为准；原渠道表中3.15米长度已更正为网站3000mm。','来源：https://mengkaile.top/#/product/p2；当前米价引用型材零售价页，核对日期 2026-09-08。']);
const ar=[];for(const size of ['1515','2020','3030','4040'])for(const a of accessories)if(a.prices[size]){const p=a.prices[size];ar.push([size,a.name.cn.replace(' only','（不含螺丝）'),p.natural,p.colored,p.naturalBulk,p.coloredBulk,a.note||'']);}
const as=table(profileBook,'配件价格','铝型材配件价格',['适配型材','配件名称','银白','彩色','银白≥20件','彩色≥20件','配套说明'],ar,[13,52,13,13,16,16,30],[2,3,4,5]);
notes(as,40,['单位：元 / 件。批量门槛为同一配件明细≥20件；不同明细数量不合并。','1号配螺丝，5号配顶丝，2号不含螺丝。端盖2020/3030所有颜色同价。','来源：https://mengkaile.top/#/product/accessory；线上版本核对日期 2026-09-08。']);
const hpRows=[];let size='';for(const row of original['铝型材及配件价格表260325.xlsx']['铝型材配件价格']){if(typeof row[8]==='string'&&row[8].includes('适配'))size=row[8].replace('代号/适配','');else if(row[8])hpRows.push([size,row[8],row[9],row[10],row[11],row[13],row[14]]);}
const hp=table(profileBook,'原配件参考','原配件表历史参考（不作为当前报价）',['规格','原配件名称','材质','原银白','原彩色','原银白批量','原彩色批量'],hpRows,[13,42,14,15,15,18,18],[3,4,5,6]);hp.tabColor='#A28B55';
notes(hp,27,['本页保留原配件记录。原批量规则为同色100个，网站已改为同一配件明细20件。','原M4/M6/M8圆头半圆头名称不能与网站具体螺纹/长度/头型一一匹配，不直接套用新价格。','4040的1号、2号、5号未列入网站当前配件配置；3号大批量定做请另询。','原渠道说明：单次单色半吨以上按铝价+加工费另行议价；不属于网站固定会员价格。','原表含切割、损耗，不含打孔攻丝斜切等加工及税运。店铺信息：上海暖橙黄信息科技有限公司。','来源：用户提供的《铝型材及配件价格表260325.xlsx》。当前价格见前三页。']);
notes(hp,35,['原表配件识别图（保留参考；实际可选规格以当前配件价格页为准）']);
const originalPhoto=await fs.readFile(path.join(qa,'original-accessories.png'));
hp.images.add({dataUrl:`data:image/png;base64,${originalPhoto.toString('base64')}`,anchor:{from:{row:36,col:0},extent:{widthPx:560,heightPx:747}}});
ranges.get(hp.name).last=77;

await fs.mkdir(out,{recursive:true});await fs.mkdir(qa,{recursive:true});
for(const [id,book,filename,names] of [['boards',boardBook,'萌开了板材价格表2026.xlsx',['板材零售价','板材VIP+','历史参考']],['profiles',profileBook,'萌开了铝型材及配件价格表2026.xlsx',['型材零售价','型材会员价','配件价格','原配件参考']]]){
 book.recalculate();
 console.log(id,(await book.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!',options:{useRegex:true,maxResults:20},summary:'final formula error scan'})).ndjson);
 if(id==='profiles'){
  const actual=member.getRange('B6:G30').values;
  for(let i=0;i<25;i++){const p=profiles[i].price;const expected=[p.oxidized-2,p.electrophoretic-2,p.powder-2,p.oxidized-4,p.electrophoretic-4,p.powder-4];if(actual[i].some((v,j)=>Math.abs(v-expected[j])>1e-8))throw Error(`Member price mismatch ${i}`);}
  retail.getRange('C6').values=[[13]];book.recalculate();if(member.getRange('B6').values[0][0]!==11||member.getRange('E6').values[0][0]!==9)throw Error('Member recalculation failed');retail.getRange('C6').values=[[12]];book.recalculate();
  console.log('All 150 member prices checked; changed-source recalculation passed.');
 }
 for(const name of names){const r=ranges.get(name);const blob=await book.render({sheetName:name,range:`A1:${r.end}${r.last}`,scale:1});await fs.writeFile(path.join(qa,`${id}-${name}.png`),new Uint8Array(await blob.arrayBuffer()));}
 const file=await SpreadsheetFile.exportXlsx(book);await file.save(path.join(out,filename));console.log(`Exported ${filename}`);
}
