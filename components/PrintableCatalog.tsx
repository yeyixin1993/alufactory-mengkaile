import React, { useState } from 'react';
import { INITIAL_PRODUCTS, PROFILE_VARIANTS } from '../constants';
import { ACCESSORY_DEFINITIONS, ACCESSORY_IMAGE, type AccessoryProfileSize } from '../data/accessoryCatalog';
import { PEGBOARD_PRICE_PER_SQM, ALUMINUM_PLATE_PRICE_PER_SQM, VIP_PLUS_PEGBOARD_PRICE_PER_SQM, VIP_PLUS_ALUMINUM_PLATE_PRICE_PER_SQM, MARINE_BOARD_SPEC_PRICE_PER_SQM, MARINE_BOARD_COLORED_SURCHARGE_PER_SQM, MIN_BOARD_CHARGE_AREA_SQM, DOOR_HINGE_UNIT_PRICE } from '../data/boardPricing';
import { ACCESSORY_BULK_THRESHOLD } from '../utils/accessoryPricing';
import './PrintableCatalog.css';
import catalogCss from './PrintableCatalog.css?inline';
import { catalogLocale, localizeCatalog } from '../utils/catalogLocalization';
import type { Language, User } from '../types';
import { normalizeMembershipLevel } from '../utils/membership';
import { downloadCatalogHtml } from '../utils/catalogDownload';

export const CATALOG_EDITION = '2026.09';
const money = (value: number) => `¥${Number(value.toFixed(2))}`;
const productImage = (id: string) => INITIAL_PRODUCTS.find(p => p.id === id)!.imageUrl;
const shop = (id: string) => `https://mengkaile.top/#/product/${id}`;

export async function printCatalog() {
  await document.fonts.ready;
  await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>('.mkl-catalog img')).map(img => img.decode().catch(() => undefined)));
  window.print();
}

function Page({ number, title, children, className = '', id }: { number: number; title: string; children: React.ReactNode; className?: string; id?: string }) {
  return <section className={`mkl-page mkl-page-${number} ${className}`} id={id} aria-label={title}>
    <header className="mkl-running"><span>萌开了家居 / ALUMEN</span><span>{title}</span></header>
    <div className="mkl-page-body">{children}</div>
    <footer className="mkl-folio"><span>mengkaile.top</span><span>产品与价格画册 · {CATALOG_EDITION}</span><b>{String(number).padStart(2, '0')}</b></footer>
  </section>;
}

function Heading({ index, title, text }: { index: string; title: string; text: string }) {
  return <div className="mkl-heading"><div className="mkl-eyebrow">{index} / COLLECTION</div><h2>{title}</h2><p>{text}</p></div>;
}

function ProfileTable({ start, end }: { start: number; end: number }) {
  return <table className="mkl-table mkl-profile-table"><caption>标准零售价 · 人民币元 / 米</caption><thead><tr><th>型号</th><th>截面图</th><th>壁厚 mm</th><th>喷砂氧化银白</th><th>彩色<br />截面本色</th><th>彩色<br />截面同色</th></tr></thead><tbody>{PROFILE_VARIANTS.slice(start, end).map(p => <tr key={p.id}><th>{p.name}</th><td className="mkl-section-cell">{['3060-N1-60', '4080'].includes(p.id) ? <span className="mkl-section-missing">截面图待补</span> : <img src={`/images/profile_${p.id}.png`} alt={`${p.name}截面图`} />}</td><td>{p.wallThickness.toFixed(1)}</td><td>{money(p.price.oxidized)}</td><td>{money(p.price.electrophoretic)}</td><td>{money(p.price.powder)}</td></tr>)}</tbody></table>;
}

const accessoryRows = (['1515', '2020', '3030', '4040'] as AccessoryProfileSize[]).flatMap(size => ACCESSORY_DEFINITIONS.filter(a => a.prices[size]).map(a => ({ a, size, price: a.prices[size]! })));
const accessoryName = (a: typeof ACCESSORY_DEFINITIONS[number]) => a.name.cn.replace(' only', '（不含螺丝）').replace('10号螺丝 · ', '').replace('10号配件 · ', '');
function AccessoryTable({ start, end }: { start: number; end: number }) {
  return <table className="mkl-table mkl-consolidated-table"><thead><tr><th>配件</th><th>规格</th><th>本色</th><th>彩色</th><th>本色批量</th></tr></thead><tbody>{accessoryRows.slice(start, end).map(({a, size, price}) => <tr key={`${size}-${a.id}`}><th>{accessoryName(a)}{a.note && <small>{a.note}</small>}</th><td>{size}</td><td>{money(price.natural)}</td><td>{money(price.colored)}</td><td>{money(price.naturalBulk)}</td></tr>)}</tbody></table>;
}
function VipAccessoryTable() {
  return <table className="mkl-table mkl-vip-accessories"><caption>彩色配件批量价 · 元 / 件 · 同一明细 ≥{ACCESSORY_BULK_THRESHOLD} 件</caption><thead><tr><th>配件</th>{['1515','2020','3030','4040'].map(size => <th key={size}>{size}</th>)}</tr></thead><tbody>{ACCESSORY_DEFINITIONS.map(a => <tr key={a.id}><th>{accessoryName(a)}</th>{(['1515','2020','3030','4040'] as AccessoryProfileSize[]).map(size => <td key={size}>{a.prices[size] ? money(a.prices[size]!.coloredBulk) : '—'}</td>)}</tr>)}</tbody></table>;
}

export function CatalogPages({ user, language = 'cn' }: { user?: User | null; language?: Language } = {}) {
  const vipPlus = !!user && normalizeMembershipLevel(user.membershipLevel) === 'vip_plus';
  return localizeCatalog(<div className="mkl-pages" lang={catalogLocale[language]}>
    <section className="mkl-page mkl-original-cover" id="catalog-cover" aria-label="萌开了家居"><img src="/images/catalog-editorial/cover-background.png" alt="" className="mkl-cover-background" /><div className="mkl-cover-copy"><b className="mkl-cover-brand">ALUMEN</b><h1>萌开了家居</h1><span className="mkl-cover-rule" /><p className="mkl-cover-tagline">探索金属的色彩美学</p><p className="mkl-cover-expertise">20多年经验 · 铝合金表面处理专家 · 为设计赋予色彩</p></div></section>
    <Page number={2} title="关于我们">
      <Heading index="00" title="从铝材，到家居成品。" text="上海至绘艺术品有限公司 / 铝合金全制程制造与家居应用" />
      <div className="mkl-company-intro"><p>拥有20多年经验，生产基地位于山东临沂，拥有 30,000 多平方米生产车间。公司以艺术品装裱用实木线条、铝合金线条为基础，延伸至极简铝合金家居的成品与半成品制造。</p><p>从熔铸、挤压到表面处理与精密加工，将材料、色彩和成品制造衔接在一起，为不同的设计需求提供铝应用方案。</p></div>
      <div className="mkl-company-grid"><img src="/images/catalog-editorial/factory.jpg" alt="公司画册中的数控加工设备" /><div><h3>材料与成形</h3><p>熔铸、挤压，形成不同用途的铝合金线条与型材。</p><h3>表面与色彩</h3><p>阳极氧化、电泳、喷涂、木纹转印、水性烤漆，以及喷砂、拉丝与抛光。</p><h3>加工与成品</h3><p>CNC 加工、钻孔、铣槽与攻牙，连接家居成品及半成品制造。</p></div></div>
      <div className="mkl-contents"><h3>画册导览</h3><div><span>工艺与色彩</span><b>03</b></div><div><span>铝型材规格与价格</span><b>04—05</b></div><div><span>板材与铝框门</span><b>06—07</b></div><div><span>连接配件与阶梯价格</span><b>08</b></div><div><span>家居应用与选购联系</span><b>09—16</b></div></div>
    </Page>
    <Page number={3} title="工艺与色彩" id="catalog-colors">
      <Heading index="01" title="金属的线条，生活的色彩。" text="从画册中的阳极氧化与水性喷漆工艺，到可以按尺寸选购的型材和板材，让材质与空间一起表达。" />
      <div className="mkl-original-crafts"><figure><img src="/images/catalog-editorial/anodizing.jpg" alt="原画册阳极氧化彩色型材" /><figcaption><h3>阳极氧化</h3><p>保留金属质感，为型材与家居细节赋予色彩。</p></figcaption></figure><figure><img src="/images/catalog-editorial/painting.jpg" alt="原画册水性喷漆工艺" /><figcaption><h3>水性喷漆</h3><p>呈现柔和的色彩与触感。特殊颜色及非标工艺请联系确认。</p></figcaption></figure></div>
      <div className="mkl-palette-panel"><h3 className="mkl-section-label">型材实拍色卡</h3>
      <img className="mkl-color-overview" src="/images/profile-color-overview.jpg" alt="型材全部色卡合照及颜色名称" /></div>
      <div className="mkl-cut-guide"><img src="/images/profile-section-natural-vs-colored.jpg" alt="截面对比：左侧切口为铝材本色，右侧切口与表面同色" /><div><h3>截面本色 / 截面彩色</h3><p><b>截面本色：</b>型材表面为所选颜色，切口保留铝材银白本色，如图左。</p><p><b>截面彩色（截面同色）：</b>型材表面与切口均为所选颜色，如图右。</p><p>价格表中的“彩色 · 截面同色”即截面彩色。选型时请同时确认表面颜色和切口处理。</p></div></div>
      <p className="mkl-note">屏幕与打印颜色仅供参考，实际以确认色样为准。颜色及截面处理的可选组合，以网站配置器为准。</p>
    </Page>
    <Page number={4} title="铝型材 / 15与20系列" id="catalog-profiles">
      <Heading index="02" title="从一根线条开始。" text="按长度定制，用于收纳、家具框架、展示与空间构造。以下为材料米价，加工另计。" />
      <div className="mkl-profile-pair"><ProfileTable start={0} end={7} /><ProfileTable start={7} end={13} /></div>
      <p className="mkl-note">N1 / N2 / N3 / N4 表示一至四面封边，N2 对边为相对两面封边。「截面本色」与「截面同色」为两种彩色截面处理选项。</p>
    </Page>
    <Page number={5} title="铝型材 / 扩展规格">
      <Heading index="02" title="更多尺度，更多可能。" text="20系列扩展规格，以及30、40系列。标准材料米价，加工另计。" />
      <div className="mkl-profile-pair"><ProfileTable start={13} end={19} /><ProfileTable start={19} end={25} /></div>
      <p className="mkl-note">材料金额 = 长度（mm）÷ 1000 × 米价；加工费另计，最终按网站规则保留一位小数。长度须大于 20mm、最长 3000mm；不超过 100mm 的短料每根加收 ¥5 危险加工费。孔位、攻丝、斜切等按确认图纸下单。</p>
    </Page>
    <Page number={6} title="铝板、洞洞板与铝框门" id="catalog-boards">
      <Heading index="03" title="一面墙，也可以有自己的秩序。" text="铝合金洞洞板用于收纳与展示；铝板适合桌面、层板及定制构件。按尺寸与厚度计价。" />
      <div className="mkl-two-products"><figure><img src={productImage('p1')} alt="铝合金洞洞板" /><figcaption>铝合金洞洞板</figcaption></figure><figure><img src={productImage('p5')} alt="铝板" /><figcaption>铝板</figcaption></figure><figure><img src={productImage('p3')} alt="铝框门" /><figcaption>铝框门</figcaption></figure></div>
      <table className="mkl-table"><caption>标准零售价 · 人民币元 / ㎡</caption><thead><tr><th>厚度</th><th>洞洞板</th><th>铝板</th></tr></thead><tbody>{[2, 5].map(t => <tr key={t}><th>{t}mm</th><td>{money(PEGBOARD_PRICE_PER_SQM[t])}</td><td>{money(ALUMINUM_PLATE_PRICE_PER_SQM[t])}</td></tr>)}</tbody></table>

      <div className="mkl-callout"><h3>按块计费，最低 {MIN_BOARD_CHARGE_AREA_SQM}㎡</h3><p>每块金额 = max（宽 × 高 ÷ 1,000,000，{MIN_BOARD_CHARGE_AREA_SQM}）× 平方米单价。尺寸单位为 mm，单块金额保留一位小数，再乘数量。</p><p>例：2mm 铝板 500 × 300mm，按 0.2㎡计，标准零售价为 {money(ALUMINUM_PLATE_PRICE_PER_SQM[2] * MIN_BOARD_CHARGE_AREA_SQM)} / 块。</p></div>
      <p className="mkl-note">常规规格为 2mm、5mm。洞洞板最长边 ≤2400mm、最短边 ≤1200mm；具体尺寸范围以对应产品页面为准。</p>
<div className="mkl-door-description">      <div className="mkl-callout"><h3>铝框门 / 2mm 门板 · 18mm 门框</h3><p>标准价 {money(ALUMINUM_PLATE_PRICE_PER_SQM[2])} / ㎡；每扇最低 {MIN_BOARD_CHARGE_AREA_SQM}㎡。另加铰链 {money(DOOR_HINGE_UNIT_PRICE)} / 个。</p><p>门高 ≤1500 / ≤2000 / ≤2500 / ≤3000mm，分别配置 2 / 3 / 4 / 5 个铰链。最大单扇 1500 × 3000mm，默认 200mm 居中拉手。</p></div>
      <p className="mkl-note">计价示例：标准价 500 × 2000mm 铝框门，面积 1㎡ + 3 个铰链，共 {money(ALUMINUM_PLATE_PRICE_PER_SQM[2] + 3 * DOOR_HINGE_UNIT_PRICE)} / 扇。</p>
</div>
    </Page>
    <Page number={7} title="BBB 海洋板">
      <Heading index="03" title="木的温度，铝的轮廓。" text="俄罗斯全进口 BBB 海洋板，为框架补上温润的面。" />
      <div className="mkl-two-products"><figure><img src={productImage('p6')} alt="BBB海洋板" /><figcaption>BBB 海洋板</figcaption></figure><figure><img src="/images/catalog-editorial/marine-board-real.jpg" alt="海洋板与铝型材框架搭配实拍" /><figcaption>海洋板应用实拍</figcaption></figure></div>
      <table className="mkl-table"><caption>海洋板原色 · 人民币元 / ㎡</caption><thead><tr><th>规格</th><th>12mm</th><th>18mm</th></tr></thead><tbody><tr><th>BBB 素板</th><td>{money(MARINE_BOARD_SPEC_PRICE_PER_SQM.marine_bbb_plain[12])}</td><td>{money(MARINE_BOARD_SPEC_PRICE_PER_SQM.marine_bbb_plain[18])}</td></tr><tr><th>BBB 两面 UV 清漆 + 覆膜</th><td>{money(MARINE_BOARD_SPEC_PRICE_PER_SQM.marine_bbb_uv_film[12])}</td><td>{money(MARINE_BOARD_SPEC_PRICE_PER_SQM.marine_bbb_uv_film[18])}</td></tr></tbody></table>
      <p className="mkl-note">彩色海洋板在所选板材单价上加 {money(MARINE_BOARD_COLORED_SURCHARGE_PER_SQM)} / ㎡。每块最低计费 {MIN_BOARD_CHARGE_AREA_SQM}㎡；最大尺寸 2440 × 1220mm。网站当前提供 12mm、18mm。</p>
    </Page>
    <Page number={8} title="配件 / 全规格价格" id="catalog-accessories" className="mkl-all-accessories">
      <Heading index="04" title="连接，一页选齐。" text="1515 / 2020 / 3030 / 4040 适配规格 · 人民币元 / 件。本色批量价适用于同一配件明细达到 20 件，不同明细不合并计算。" />
      <div className="mkl-accessory-layout"><figure className="mkl-accessory-reference"><img src={ACCESSORY_IMAGE} alt="1至10号铝型材连接配件编号识别图" /><figcaption>1–10号配件识别图</figcaption></figure><div className="mkl-accessory-pair"><AccessoryTable start={0} end={Math.ceil(accessoryRows.length / 2)} /><AccessoryTable start={Math.ceil(accessoryRows.length / 2)} end={accessoryRows.length} /></div></div>
      <p className="mkl-note">1号含配套螺丝，5号含顶丝，2号不含螺丝；其余配件与螺丝按明细选购。请核对配件与型材的适配规格。</p>
    </Page>
    <Page number={9} title="家居与应用" id="catalog-home">
      <Heading index="05" title="把想法，装进日常。" text="从工作室的一面收纳墙，到家中的柜体和展架。产品组合随尺寸、板材、颜色与配件变化。" />
      <img className="mkl-lifestyle" src="/images/catalog-editorial/pegboard.jpg" alt="原画册中的洞洞板收纳应用" />
      <div className="mkl-home-products">{['p7', 'p8', 'p9', 'p4'].map(id => { const p = INITIAL_PRODUCTS.find(p => p.id === id)!; return <article key={id}><img src={p.imageUrl} alt={p.name.cn} /><h3>{p.name.cn}</h3><p>{id === 'p4' ? '尺寸与工艺确认后报价' : '按尺寸与材料配置报价'}</p><a href={shop(id)}>查看产品 ↗</a></article>; })}</div>
      <p className="mkl-note">家居照片为应用参考，不对应固定套装价。定制柜体、展架与相框请通过网站或微信确认完整配置后报价。</p>
    </Page>
    <Page number={10} title="User Stories" className="mkl-story-page">
      <Heading index="User Stories" title="真实生活，各有秩序。" text="洞洞板应用实景 / 从工作室到家中的一角。" />
      <div className="mkl-story-images"><figure><img src="/images/catalog-editorial/story-08-05.jpg" alt="工作空间，原画册案例图片" /><figcaption>工作空间</figcaption></figure><figure><img src="/images/catalog-editorial/story-08-02.jpg" alt="咖啡角，原画册案例图片" /><figcaption>咖啡角</figcaption></figure><figure><img src="/images/catalog-editorial/story-08-03.jpg" alt="彩色洞洞板，原画册案例图片" /><figcaption>彩色洞洞板</figcaption></figure></div>
    </Page>
    <Page number={11} title="极简铝框 & 实木框" className="mkl-story-page mkl-frame-story">
      <Heading index="极简铝框 & 实木框" title="让作品，有自己的边界。" text="金属的利落与木材的温度，为照片、绘画与生活收藏留出位置。" />
      <div className="mkl-story-images"><figure><img src="/images/catalog-editorial/story-09-03.jpg" alt="极简画框组合，原画册案例图片" /><figcaption>极简画框组合</figcaption></figure><figure><img src="/images/catalog-editorial/story-09-01.jpg" alt="边角与材质细节，原画册案例图片" /><figcaption>边角与材质细节</figcaption></figure></div>
      <div className="mkl-frame-price"><b>相框定价 · ¥50 / 米</b><span>按周长计价：价格 = 2 ×（宽 + 高）÷ 1000 × ¥50，宽高单位为 mm。</span><span>例如 500 × 700mm：周长 2.4 米，价格 ¥120。</span></div>
    </Page>
    <Page number={12} title="Gallery View" className="mkl-story-page">
      <Heading index="Gallery View" title="把喜欢，认真装裱。" text="艺术空间陈列 / 从单幅作品到一整面收藏。" />
      <div className="mkl-story-images"><figure><img src="/images/catalog-editorial/story-10-07.jpg" alt="金属框，原画册案例图片" /><figcaption>金属框</figcaption></figure><figure><img src="/images/catalog-editorial/story-10-08.jpg" alt="收藏与装裱，原画册案例图片" /><figcaption>收藏与装裱</figcaption></figure><figure><img src="/images/catalog-editorial/story-10-09.jpg" alt="实木框样，原画册案例图片" /><figcaption>实木框样</figcaption></figure></div>
    </Page>
    <Page number={13} title="Custom Details" className="mkl-story-page">
      <Heading index="Custom Details" title="细节，回应你的想法。" text="定制案例细节 / 从结构到色彩，让设计落在实处。" />
      <div className="mkl-story-images"><figure><img src="/images/catalog-editorial/story-12-07.jpg" alt="定制支架，原画册案例图片" /><figcaption>定制支架</figcaption></figure><figure><img src="/images/catalog-editorial/story-12-08.jpg" alt="彩色型材样品，原画册案例图片" /><figcaption>彩色型材样品</figcaption></figure><figure><img src="/images/catalog-editorial/story-12-09.jpg" alt="型材连接细节，原画册案例图片" /><figcaption>型材连接细节</figcaption></figure></div>
    </Page>
    <Page number={14} title="Luxury Living" className="mkl-story-page">
      <Heading index="Luxury Living" title="让定制，融入日常。" text="全屋定制案例 / 收纳、展示与家务空间，按生活的尺度安排。" />
      <div className="mkl-story-images"><figure><img src="/images/catalog-editorial/story-14-06.jpg" alt="移动收纳，原画册案例图片" /><figcaption>移动收纳</figcaption></figure><figure><img src="/images/catalog-editorial/story-14-07.jpg" alt="开放展示架，原画册案例图片" /><figcaption>开放展示架</figcaption></figure><figure><img src="/images/catalog-editorial/story-14-08.jpg" alt="家务空间柜体，原画册案例图片" /><figcaption>家务空间柜体</figcaption></figure></div>
    </Page>
    <Page number={15} title="他们都选择了我们" className="mkl-story-page">
      <Heading index="他们都选择了我们" title="不同的空间，同样的用心。" text="从商业空间到家居品牌，与设计师一起探索材料的更多可能。" />
      <div className="mkl-story-images"><figure><img src="/images/catalog-editorial/story-17-02.jpg" alt="商业空间，原画册案例图片" /><figcaption>商业空间</figcaption></figure><figure><img src="/images/catalog-editorial/story-17-03.jpg" alt="家居品牌，原画册案例图片" /><figcaption>家居品牌</figcaption></figure><figure><img src="/images/catalog-editorial/story-17-04.jpg" alt="设计师合作，原画册案例图片" /><figcaption>设计师合作</figcaption></figure></div>
    </Page>
    <Page number={16} title="选购与联系" id="catalog-contact">
      <Heading index="06" title="下一步，让它成为你的家。" text="在网站选好材料与尺寸，确认报价与图纸，再安排制作。" />
      <ol className="mkl-order-steps"><li><b>选择材料与颜色</b><p>核对型号、厚度、表面颜色与截面处理。</p></li><li><b>填写尺寸与加工</b><p>尺寸统一使用 mm；注明孔位、攻丝、斜切和数量。</p></li><li><b>核对订单与图纸</b><p>在网站查看完整报价，确认图纸后下单生产。</p></li></ol>
      <div className="mkl-contact"><div><div className="mkl-eyebrow">MENGKAILE HOME</div><h2>萌开了家居</h2><p>官方网站</p><a href="https://mengkaile.top">mengkaile.top</a><p>微信 / 19821200413</p></div></div>
      <div className="mkl-contact-channels"><figure><img src="/images/wechat-qr.jpg" alt="萌开了微信联系二维码" /><figcaption><b>微信咨询</b><span>扫码确认方案与图纸</span></figcaption></figure><figure><img src="/images/catalog-editorial/taobao-qr.jpg" alt="萌开了淘宝店二维码" /><figcaption><b>淘宝店</b><span>使用淘宝扫一扫</span></figcaption></figure><figure><img src="/images/catalog-editorial/xiaohongshu-qr.jpg" alt="萌开了家居小红书二维码" /><figcaption><b>小红书</b><span>发现更多家居灵感</span></figcaption></figure></div>
      <div className="mkl-price-notes"><h3>价格阅读说明</h3><p>本画册以人民币标价，按材料的米、平方米或件计价。除明确标注的配件批量价外，均为标准零售价。运输费用按实际订单计算。</p><p>画册版本 {CATALOG_EDITION}。下载的 HTML、PDF 与 Excel 为当时价格快照；下单前请在网站确认当前价格、账户资格、可选规格和库存。</p><p>品牌与应用图片参考《萌开了家居画册2026》。定制项目以双方确认的尺寸、工艺、图纸和最终订单为准。</p></div>
    </Page>
    {vipPlus && <Page number={17} title="VIP+ 专属权益" id="catalog-vip-plus">
      <Heading index="07" title="为你专属，更多选择。" text="VIP+ 用户专属权益 · 本页仅向已登录的 VIP+ 账户提供" />
      <div className="mkl-vip-account"><span>本页专属于 VIP+ 用户</span><h3>账号手机号：{user.id}</h3><p>此为该账号的专属权益页，随画册浏览、下载及打印一同附在最后。</p></div>
      <div className="mkl-callout"><h3>铝型材专属价格</h3><p>在第 04—05 页所列标准材料米价基础上，每米减 ¥4。加工费用按网站规则另计。</p></div>
      <table className="mkl-table mkl-compact"><caption>VIP+ 专享规格与价格 · 人民币元 / ㎡</caption><thead><tr><th>厚度</th>{[1, 2, 3, 4, 5].map(t => <th key={t}>{t}mm</th>)}</tr></thead><tbody><tr><th>洞洞板</th>{[1, 2, 3, 4, 5].map(t => <td key={t}>{money(VIP_PLUS_PEGBOARD_PRICE_PER_SQM[t])}</td>)}</tr><tr><th>铝板</th>{[1, 2, 3, 4, 5].map(t => <td key={t}>{money(VIP_PLUS_ALUMINUM_PLATE_PRICE_PER_SQM[t])}</td>)}</tr></tbody></table>
      <div className="mkl-callout"><h3>铝框门专属价格</h3><p>2mm 门板 · 18mm 门框：{money(VIP_PLUS_ALUMINUM_PLATE_PRICE_PER_SQM[2])} / ㎡，每扇最低计费 {MIN_BOARD_CHARGE_AREA_SQM}㎡，另加铰链 {money(DOOR_HINGE_UNIT_PRICE)} / 个。</p></div>
      <VipAccessoryTable />
      <p className="mkl-note">板材按块计费，每块最低 {MIN_BOARD_CHARGE_AREA_SQM}㎡。上述权益仅适用于本页所列 VIP+ 账号，下单时以该账号当前资格及网站报价为准。</p>
    </Page>}
  </div>, language);
}

export default function PrintableCatalog({ user, language = 'cn' }: { user?: User | null; language?: Language } = {}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [printing, setPrinting] = useState(false);
  return localizeCatalog(<main className="mkl-catalog" lang={catalogLocale[language]}>
    <div className="mkl-toolbar"><div><a href="https://mengkaile.top">萌开了家居</a><span>产品与价格画册 · {CATALOG_EDITION}</span></div><button type="button" data-catalog-print disabled={printing} onClick={async () => { setPrinting(true); try { await printCatalog(); } finally { setPrinting(false); } }}>{printing ? '正在准备图片…' : '打印 / 保存 PDF'}</button></div>
    <div className="mkl-print-help">打印时选择 A4 横向、缩放 100%，关闭浏览器页眉页脚。目标打印机选择「另存为 PDF」。<button type="button" data-catalog-download disabled={downloading} onClick={async () => { setDownloading(true); setDownloadError(''); try { await downloadCatalogHtml(catalogCss, language); } catch { setDownloadError('下载失败，请检查网络后重试。'); } finally { setDownloading(false); } }}>{downloading ? '正在准备下载…' : '下载离线 HTML'}</button>{downloadError && <span role="alert">{downloadError}</span>}</div>
    <CatalogPages user={user} />
  </main>, language);
}
