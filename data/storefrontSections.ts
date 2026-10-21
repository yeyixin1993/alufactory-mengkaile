import type { Language } from '../types';

/**
 * 三块「网店有、网站缺」的商品板块 —— 洞洞板配件 / 成品家具 / 样品购买。
 *
 * 数据来源与口径（重要）：
 *  1. 价格优先用网站画册价（PrintableCatalog 已公示的价），这是对外的权威价。
 *  2. 网站还没定过价的（成品家具、部分样板），先借用网店现售价并标 priceSource: 'shop' +
 *     needsReview: true，等老板确认后再改 priceSource: 'website'。不许静默把网店价当成官网价。
 *  3. purchase: 'cart'  = 固定价，可直接加购；
 *     purchase: 'quote' = 区间价/按配置报价，不做加购，走询价（避免官网出现「起价即成交价」）。
 *  4. imageUrl 为空表示还没有实拍图，前端渲染占位并标注「产品图待补」，不得用别的品类图片冒充。
 *
 * 网店侧同一批货的成交记录见 eshop 仓库 products/sync-gaps.json → addToWebsite。
 */

export type StorefrontSectionId = 'pegboard-accessories' | 'finished-furniture' | 'samples';

export type LocalizedText = Record<Language, string>;

export interface StorefrontOptionValue {
  id: string;
  label: LocalizedText;
  /** 相对基准价的加价（元），不填为 0 */
  priceDelta?: number;
}

export interface StorefrontOption {
  id: string;
  label: LocalizedText;
  values: StorefrontOptionValue[];
}

export interface StorefrontItem {
  id: string;
  sectionId: StorefrontSectionId;
  name: LocalizedText;
  summary: LocalizedText;
  spec?: LocalizedText;
  imageUrl: string;
  /** 细节图（螺丝/垫片类）用 contain，避免 object-cover 把主体裁掉 */
  imageFit?: 'cover' | 'contain';
  unit: 'pc' | 'set' | 'pack';
  /** 固定单价（元）。purchase==='cart' 时必填 */
  price?: number;
  /** 区间价（元） */
  priceFrom?: number;
  priceTo?: number;
  priceSource: 'website' | 'shop';
  needsReview?: boolean;
  purchase: 'cart' | 'quote';
  options?: StorefrontOption[];
  /** 估算发货重量，工厂单/运费要用；固定件按单件，套装按整套 */
  shippingWeightKg: number;
  shopEvidence?: Array<{ platform: '1688' | '淘宝' | '小红书'; price: string }>;
  note?: LocalizedText;
}

export interface StorefrontSection {
  id: StorefrontSectionId;
  title: LocalizedText;
  eyebrow: LocalizedText;
  description: LocalizedText;
  /** 首页卡片用的代表图，空则用板块色块 */
  coverImage: string;
  accent: 'emerald' | 'amber' | 'blue';
  items: StorefrontItem[];
}

const COLOR_OPTION = (): StorefrontOption => ({
  id: 'color',
  label: { cn: '颜色', en: 'Color', jp: '色' },
  values: [
    { id: 'natural', label: { cn: '银白（阳极氧化）', en: 'Silver white (anodized)', jp: 'シルバーホワイト（アルマイト）' } },
    { id: 'colored', label: { cn: '彩色（喷涂）', en: 'Colored (powder coated)', jp: 'カラー（粉体塗装）' } },
  ],
});

const PEGBOARD_ITEMS: StorefrontItem[] = [
  {
    id: 'sf-pb-rod',
    sectionId: 'pegboard-accessories',
    name: { cn: '彩色铝合金洞洞板挂杆', en: 'Colored aluminum pegboard rod', jp: 'カラーアルミペグボード用ロッド' },
    summary: {
      cn: '宜家孔免打孔挂杆，含安装配件，适配 1–5mm 板厚。',
      en: 'IKEA-hole rod, no drilling, fittings included, fits 1–5 mm boards.',
      jp: 'IKEA穴対応・穴あけ不要のロッド。取付金具付き、板厚1〜5mm対応。',
    },
    spec: { cn: '单支 / 含配件', en: 'Per rod / fittings included', jp: '1本 / 金具込み' },
    imageUrl: '/images/accessories/pegboard-01.jpg',
    unit: 'pc',
    price: 12,
    priceSource: 'website',
    purchase: 'cart',
    options: [COLOR_OPTION()],
    shippingWeightKg: 0.15,
    shopEvidence: [
      { platform: '淘宝', price: '¥2–12（多规格）' },
      { platform: '小红书', price: '¥2–12' },
      { platform: '1688', price: '¥12' },
    ],
    note: {
      cn: '100 支及以上按 ¥8/支，画册同价。',
      en: 'From 100 pcs: ¥8 each, same as catalog.',
      jp: '100本以上は1本¥8（カタログ同価）。',
    },
  },
  {
    id: 'sf-pb-hook-short',
    sectionId: 'pegboard-accessories',
    name: { cn: '洞洞板短挂钩', en: 'Pegboard short hook', jp: 'ペグボード用ショートフック' },
    summary: {
      cn: '粗挂钩，挂钥匙、毛绒玩具、小工具，宜家孔直插。',
      en: 'Thick hook for keys, plush toys and small tools; pushes straight into IKEA holes.',
      jp: '鍵・ぬいぐるみ・小物用の太フック。IKEA穴に直接差し込み。',
    },
    spec: { cn: '单支', en: 'Per hook', jp: '1本' },
    imageUrl: '/images/accessories/pegboard-04.jpg',
    unit: 'pc',
    price: 2.5,
    priceSource: 'website',
    purchase: 'cart',
    options: [COLOR_OPTION()],
    shippingWeightKg: 0.05,
    shopEvidence: [
      { platform: '淘宝', price: '¥2' },
      { platform: '小红书', price: '¥2–12' },
    ],
  },
  {
    id: 'sf-pb-hook-long',
    sectionId: 'pegboard-accessories',
    name: { cn: '洞洞板长挂钩', en: 'Pegboard long hook', jp: 'ペグボード用ロングフック' },
    summary: {
      cn: '长钩，挂卷尺、耳机线、工具手柄，出墙更深不易掉。',
      en: 'Long hook for tape measures, cables and tool handles; deeper reach holds better.',
      jp: 'メジャー・ケーブル・工具用ロングフック。出寸が深く外れにくい。',
    },
    spec: { cn: '单支', en: 'Per hook', jp: '1本' },
    imageUrl: '/images/accessories/pegboard-03.jpg',
    unit: 'pc',
    price: 5,
    priceSource: 'website',
    purchase: 'cart',
    options: [COLOR_OPTION()],
    shippingWeightKg: 0.06,
    shopEvidence: [
      { platform: '淘宝', price: '¥2' },
      { platform: '小红书', price: '¥2–12' },
    ],
  },
  {
    id: 'sf-pb-shelf',
    sectionId: 'pegboard-accessories',
    name: { cn: '洞洞板托盘 / 置物盘', en: 'Pegboard tray', jp: 'ペグボード用トレー' },
    summary: {
      cn: '铝合金置物盘，可定长，书法/文具/绿植摆件首选。',
      en: 'Aluminum tray, length customizable; for stationery, plants and display items.',
      jp: 'アルミトレー。長さ変更可。文具・植物・飾り用。',
    },
    spec: { cn: '可定制长度', en: 'Custom length', jp: '長さ変更可' },
    imageUrl: '/images/accessories/pegboard-05.jpg',
    unit: 'pc',
    price: 25,
    priceSource: 'website',
    purchase: 'cart',
    options: [COLOR_OPTION()],
    shippingWeightKg: 0.3,
    shopEvidence: [
      { platform: '淘宝', price: '¥25' },
      { platform: '小红书', price: '¥25' },
      { platform: '1688', price: '¥25' },
    ],
    note: {
      cn: '长度超过 400mm 需按实际尺寸核价。',
      en: 'Over 400 mm is priced by actual length.',
      jp: '400mm超は実寸で再見積。',
    },
  },
  {
    id: 'sf-pb-selflock',
    imageFit: 'contain',
    sectionId: 'pegboard-accessories',
    name: { cn: '自锁挂杆配件（含垫片）', en: 'Self-locking rod kit (with washers)', jp: 'セルフロックロッドキット（ワッシャー付）' },
    summary: {
      cn: '专利自锁结构，后装也咬得住，适合已装好的洞洞板加装。',
      en: 'Patented self-locking design; retrofits onto pegboards already installed.',
      jp: '特許セルフロック構造。設置済みペグボードにも後付け可能。',
    },
    spec: { cn: '按套报价', en: 'Quoted per set', jp: 'セット見積' },
    imageUrl: '/images/accessories/pegboard-06.jpg',
    unit: 'set',
    priceSource: 'shop',
    purchase: 'quote',
    shippingWeightKg: 0.3,
    shopEvidence: [{ platform: '小红书', price: '¥2.5–99（按套）' }],
    note: {
      cn: '按洞洞板孔距和数量配货，先报规格再报价。',
      en: 'Priced after hole pitch and quantity are confirmed.',
      jp: '穴ピッチと数量を確認してから見積。',
    },
  },
  {
    id: 'sf-pb-cap',
    imageFit: 'contain',
    sectionId: 'pegboard-accessories',
    name: { cn: '洞洞板螺丝堵盖 / 面板', en: 'Pegboard screw cap panel', jp: 'ペグボード用ビスキャップ' },
    summary: {
      cn: '长方形面板堵盖，遮螺丝孔、收边，强度高、易安装。',
      en: 'Rectangular cap panel that hides screws and finishes edges; strong and easy to fit.',
      jp: '長方形キャップ。ビス穴を隠して端部を仕上げ。高強度・取付簡単。',
    },
    spec: { cn: '多色 / 按套', en: 'Multi-color / per set', jp: '多色 / セット' },
    imageUrl: '/images/accessories/pegboard-02.jpg',
    unit: 'set',
    priceSource: 'shop',
    purchase: 'quote',
    shippingWeightKg: 0.2,
    note: {
      cn: '尺寸和孔位随洞洞板方案走，单独卖前先确认配比。',
      en: 'Sizing follows the pegboard layout; confirm the ratio before selling standalone.',
      jp: '寸法・穴位置はペグボード仕様に依存。単品販売前に構成を確認。',
    },
  },
];

const FURNITURE_ITEMS: StorefrontItem[] = [
  {
    id: 'sf-ff-phone-stand',
    sectionId: 'finished-furniture',
    name: { cn: '极简铝合金手机支架', en: 'Minimal aluminum phone stand', jp: 'ミニマルアルミ携帯スタンド' },
    summary: {
      cn: '150g 铝合金放置式，旅行可拆，阳极氧化不掉色。',
      en: '150 g aluminum, collapsible for travel, anodized finish.',
      jp: '150gのアルミ製。旅行可、アルマイト仕上げ。',
    },
    spec: { cn: '150g / 放置式', en: '150 g / desk type', jp: '150g / 置き型' },
    imageUrl: '',
    unit: 'pc',
    price: 29,
    priceSource: 'shop',
    needsReview: true,
    purchase: 'cart',
    options: [COLOR_OPTION()],
    shippingWeightKg: 0.25,
    shopEvidence: [{ platform: '淘宝', price: '¥29' }],
    note: {
      cn: '官网尚未定价，暂按网店现售价；确认后改为官网价。',
      en: 'Not yet priced on the website; using the shop price until confirmed.',
      jp: '公式価格未設定。確認まで店舗価格を暫用。',
    },
  },
  {
    id: 'sf-ff-led-lamp',
    sectionId: 'finished-furniture',
    name: { cn: '极简铝合金 LED 台灯', en: 'Minimal aluminum LED desk lamp', jp: 'ミニマルアルミLEDデスクランプ' },
    summary: {
      cn: '铝型材灯体，书桌 / 床头 / 装饰三用，可调角度。',
      en: 'Extruded aluminum body for desk, bedside or accent lighting; adjustable angle.',
      jp: 'アルミ押出ボディ。机・ベッドサイド・装飾用。角度調整可。',
    },
    spec: { cn: '整灯 / 含电源', en: 'Complete lamp / PSU included', jp: '完成品 / 電源付' },
    imageUrl: '',
    unit: 'pc',
    price: 549,
    priceSource: 'shop',
    needsReview: true,
    purchase: 'cart',
    options: [COLOR_OPTION()],
    shippingWeightKg: 2.2,
    shopEvidence: [{ platform: '小红书', price: '¥549' }],
    note: {
      cn: '发货按整灯打包，偏远地区另计运费。',
      en: 'Shipped as a complete lamp; remote areas incur extra freight.',
      jp: '完成品として発送。遠隔地は送料別途。',
    },
  },
  {
    id: 'sf-ff-nursing-cart',
    sectionId: 'finished-furniture',
    name: { cn: '铝型材婴儿护理台推车', en: 'Aluminum baby care cart', jp: 'アルミベビーケアワゴン' },
    summary: {
      cn: '带收纳架与万向轮，尿布台 + 收纳一体。',
      en: 'Changing station with storage rack and castors, all in one.',
      jp: '収納ラックとキャスター付き。おむつ台＋収納一体型。',
    },
    spec: { cn: '整台 / 含轮组', en: 'Complete cart / castors included', jp: '完成品 / キャスター込' },
    imageUrl: '',
    unit: 'pc',
    price: 1099,
    priceSource: 'shop',
    needsReview: true,
    purchase: 'cart',
    options: [COLOR_OPTION()],
    shippingWeightKg: 12,
    shopEvidence: [{ platform: '小红书', price: '¥1099' }],
    note: {
      cn: '大件，默认走物流，下单前客服确认到货方式。',
      en: 'Bulky item, ships by freight; confirm delivery method before ordering.',
      jp: '大型品。物流便で発送、注文前に配送方法を確認。',
    },
  },
  {
    id: 'sf-ff-device-tree',
    sectionId: 'finished-furniture',
    // 「姚老板」是设计归属，不是噱头：这个底座的原始想法是姚老板提的，名字上给他 credit。
    // 淘宝侧同一款本来就叫「姚老板设备树移动支撑底座」，这里对齐，免得同一个货两个名。
    name: { cn: '姚老板设备树移动支撑底座', en: "Boss Yao's Device tree mobile base", jp: '姚老板デバイスツリー移動ベース' },
    summary: {
      cn: '光轴 + 型材底座，支撑设备树整机，带刹车万向轮。',
      en: 'Shaft-and-profile base that carries a full device tree, locking castors.',
      jp: 'シャフト＋プロファイルのベース。デバイスツリー全体を支持、ロック付キャスター。',
    },
    spec: { cn: '标准款起 / 按配置', en: 'From standard / by configuration', jp: '標準仕様〜 / 構成次第' },
    imageUrl: '',
    unit: 'pc',
    priceFrom: 60,
    priceTo: 919,
    priceSource: 'shop',
    purchase: 'quote',
    shippingWeightKg: 6,
    shopEvidence: [
      { platform: '淘宝', price: '¥60' },
      { platform: '小红书', price: '¥30–919' },
    ],
    note: {
      cn: '价格随光轴长度、底座尺寸、轮组变化，按配置报价。',
      en: 'Price varies with shaft length, base size and castors; quoted per configuration.',
      jp: 'シャフト長・ベース寸法・キャスターで変動。構成ごと見積。',
    },
  },
  {
    id: 'sf-ff-bed',
    sectionId: 'finished-furniture',
    name: { cn: 'Homepapa DIY 铝型材床（3060）', en: 'Homepapa DIY aluminum bed (3060)', jp: 'Homepapa DIYアルミベッド（3060）' },
    summary: {
      cn: '3060 主梁，可自装可拆，尺寸按房间定。',
      en: '3060 main beams, self-assembly, sized to the room.',
      jp: '3060主梁。組立式、部屋に合わせた寸法。',
    },
    spec: { cn: '按尺寸报价', en: 'Quoted by size', jp: '寸法ごと見積' },
    imageUrl: '',
    unit: 'pc',
    priceFrom: 1600,
    priceTo: 1980,
    priceSource: 'shop',
    purchase: 'quote',
    shippingWeightKg: 30,
    shopEvidence: [{ platform: '小红书', price: '¥1600–1980' }],
    note: {
      cn: '床架不含床垫；长料超 1500mm 走专线物流。',
      en: 'Mattress not included; beams over 1500 mm ship by dedicated freight.',
      jp: 'マットレス別。1500mm超は専用物流。',
    },
  },
  {
    id: 'sf-ff-bike-cabinet',
    sectionId: 'finished-furniture',
    name: { cn: '折叠自行车收纳柜', en: 'Folding-bike storage cabinet', jp: '折りたたみ自転車収納キャビネット' },
    summary: {
      cn: '阳极氧化铝框 + 板体，室内立放折叠车，防尘不占地。',
      en: 'Anodized aluminum frame and panels; stores a folding bike upright indoors.',
      jp: 'アルマイトアルミフレーム＋パネル。室内に折りたたみ自転車を縦置き収納。',
    },
    spec: { cn: '按尺寸报价', en: 'Quoted by size', jp: '寸法ごと見積' },
    imageUrl: '',
    unit: 'pc',
    priceFrom: 1098,
    priceTo: 1998,
    priceSource: 'shop',
    purchase: 'quote',
    shippingWeightKg: 22,
    shopEvidence: [{ platform: '小红书', price: '¥1098–1998' }],
    note: {
      cn: '按自行车尺寸定内空，先量车再报价。',
      en: 'Internal size follows the bike; measure first, then quote.',
      jp: '自転車寸法に合わせて内寸を決定。採寸後に見積。',
    },
  },
];

const SAMPLE_ITEMS: StorefrontItem[] = [
  {
    id: 'sf-sp-set-16',
    sectionId: 'samples',
    name: { cn: '彩色铝合金样品套装（11 色阳极氧化 + 6 色高定漆）', en: 'Color sample set (11 anodized + 6 paint)', jp: 'カラーサンプルセット（アルマイト11色＋塗装6色）' },
    summary: {
      cn: '选色用整套色板，签单前先寄这套。',
      en: 'The full swatch set for color selection; ship it before the order is signed.',
      jp: '色決め用のフルセット。受注前に送付。',
    },
    spec: { cn: '整套 17 色', en: '17 colors / set', jp: '17色セット' },
    imageUrl: '/images/accessories/color-aluminum-01.jpg',
    unit: 'set',
    price: 35,
    priceSource: 'shop',
    needsReview: true,
    purchase: 'cart',
    shippingWeightKg: 0.4,
    shopEvidence: [
      { platform: '淘宝', price: '¥35' },
      { platform: '小红书', price: '¥35' },
    ],
    note: {
      cn: '下单正品满 500 元可抵扣样品费。',
      en: 'Sample fee is credited against orders of ¥500 or more.',
      jp: '¥500以上のご注文でサンプル代を相殺。',
    },
  },
  {
    id: 'sf-sp-profile-2020',
    sectionId: 'samples',
    name: { cn: '2020 彩色铝型材样段（约 100mm）', en: '2020 colored profile sample (~100 mm)', jp: '2020カラーアルミサンプル（約100mm）' },
    summary: {
      cn: '切面、封边、颜色一次看清，2020 全封边款可选。',
      en: 'See the cut face, sealing and color at once; sealed variants available.',
      jp: '断面・封止・色が一度に確認できる。封止タイプ選択可。',
    },
    spec: { cn: '长 100mm', en: '100 mm length', jp: '長さ100mm' },
    imageUrl: '',
    unit: 'pc',
    price: 6,
    priceSource: 'shop',
    needsReview: true,
    purchase: 'cart',
    shippingWeightKg: 0.06,
    options: [
      {
        id: 'variant',
        label: { cn: '型号', en: 'Model', jp: '型番' },
        values: [
          { id: '2020', label: { cn: '2020 标准', en: '2020 standard', jp: '2020 標準' } },
          { id: '2020-N2', label: { cn: '2020 N2 对边封', en: '2020 N2 sealed', jp: '2020 N2 封止' } },
        ],
      },
    ],
    shopEvidence: [{ platform: '淘宝', price: '¥6' }, { platform: '1688', price: '¥6' }],
  },
  {
    id: 'sf-sp-profile-3030',
    sectionId: 'samples',
    name: { cn: '3030 彩色铝型材样段', en: '3030 colored profile sample', jp: '3030カラーアルミサンプル' },
    summary: {
      cn: '大截面样段，做展示架 / 床架前先摸一下手感。',
      en: 'Large-section sample; feel the finish before committing to a rack or bed.',
      jp: '大断面サンプル。ラック・ベッド前に質感確認。',
    },
    spec: { cn: '按段', en: 'Per piece', jp: '1本' },
    imageUrl: '',
    unit: 'pc',
    price: 10,
    priceSource: 'shop',
    needsReview: true,
    purchase: 'cart',
    shippingWeightKg: 0.12,
    shopEvidence: [{ platform: '小红书', price: '¥10–70' }],
  },
  {
    id: 'sf-sp-plate-anodized',
    sectionId: 'samples',
    name: { cn: '彩色雕刻阳极氧化铝样板（2mm）', en: 'Anodized engraved aluminum sample (2 mm)', jp: 'アルマイト彫刻サンプル（2mm）' },
    summary: {
      cn: '2mm 铝板 + 雕刻工艺，看孔型和标识效果。',
      en: '2 mm plate with engraving; check hole pattern and marking quality.',
      jp: '2mm板＋彫刻。穴形状と表示品質を確認。',
    },
    spec: { cn: '2mm 厚', en: '2 mm thick', jp: '厚さ2mm' },
    imageUrl: '',
    unit: 'pc',
    price: 10,
    priceSource: 'shop',
    needsReview: true,
    purchase: 'cart',
    shippingWeightKg: 0.2,
    shopEvidence: [{ platform: '淘宝', price: '¥10' }, { platform: '小红书', price: '¥10–140' }],
  },
  {
    id: 'sf-sp-plate-paint',
    sectionId: 'samples',
    name: { cn: '彩色雕刻高定漆铝样板（2mm）', en: 'High-end paint aluminum sample (2 mm)', jp: '高級塗装サンプル（2mm）' },
    summary: {
      cn: '意式高定漆工艺样板，和阳极氧化放一起比色。',
      en: 'Italian-style paint finish sample; compare side by side with anodized.',
      jp: 'イタリア系高級塗装サンプル。アルマイトと並べて比較。',
    },
    spec: { cn: '2mm 厚', en: '2 mm thick', jp: '厚さ2mm' },
    imageUrl: '',
    unit: 'pc',
    price: 10,
    priceSource: 'shop',
    needsReview: true,
    purchase: 'cart',
    shippingWeightKg: 0.2,
    shopEvidence: [{ platform: '淘宝', price: '¥10' }, { platform: '小红书', price: '¥10–170' }],
  },
  {
    id: 'sf-sp-marine-plain',
    sectionId: 'samples',
    name: { cn: 'BBB 海洋板样板（原木 300×200）', en: 'BBB marine board sample (natural 300×200)', jp: 'BBBマリンボードサンプル（無垢 300×200）' },
    summary: {
      cn: '原木色素板样板，看层数与断面。',
      en: 'Natural plain board sample; inspect plies and cut edge.',
      jp: '無垢素板サンプル。積層と断面を確認。',
    },
    spec: { cn: '300×200mm', en: '300×200 mm', jp: '300×200mm' },
    imageUrl: '/images/catalog-editorial/marine-board-real.jpg',
    unit: 'pc',
    price: 49,
    priceSource: 'website',
    purchase: 'cart',
    shippingWeightKg: 0.8,
    shopEvidence: [{ platform: '小红书', price: '¥155–200（正板）' }],
  },
  {
    id: 'sf-sp-marine-multi',
    sectionId: 'samples',
    name: { cn: 'BBB 海洋板样板（胡桃 / 柚木 / 樱桃，各 1 块）', en: 'BBB marine board sample set (walnut / teak / cherry)', jp: 'BBBマリンボードサンプルセット（ウォールナット/チーク/チェリー）' },
    summary: {
      cn: '三色拼一套，定柜体前先定木色。',
      en: 'Three colors as a set; pick the wood tone before the cabinet.',
      jp: '3色セット。キャビネット前に木色を決定。',
    },
    spec: { cn: '300×200mm × 3', en: '300×200 mm × 3', jp: '300×200mm × 3' },
    imageUrl: '/images/catalog-editorial/marine-board-real.jpg',
    unit: 'set',
    price: 59,
    priceSource: 'website',
    purchase: 'cart',
    shippingWeightKg: 2.2,
  },
];

export const STOREFRONT_SECTIONS: StorefrontSection[] = [
  {
    id: 'pegboard-accessories',
    title: { cn: '洞洞板配件', en: 'Pegboard Accessories', jp: 'ペグボード用アクセサリー' },
    eyebrow: { cn: 'Pegboard Ecosystem', en: 'Pegboard Ecosystem', jp: 'ペグボードエコシステム' },
    description: {
      cn: '挂杆、挂钩、托盘、自锁件 —— 板子买了配不上件，是最容易丢的复购。',
      en: 'Rods, hooks, trays and self-locking parts — the repeat purchase a bare pegboard always loses.',
      jp: 'ロッド・フック・トレー・セルフロック金具。ボード単体では失われるリピート需要。',
    },
    coverImage: '/images/accessories/pegboard-01.jpg',
    accent: 'emerald',
    items: PEGBOARD_ITEMS,
  },
  {
    id: 'finished-furniture',
    title: { cn: '成品家具', en: 'Finished Furniture', jp: '完成家具' },
    eyebrow: { cn: 'Ready-to-use', en: 'Ready-to-use', jp: '完成品' },
    description: {
      cn: '铝型材成品：设备树底座、台灯、护理台推车、床架、收纳柜。固定价可直接下单，按尺寸做的走报价。',
      en: 'Aluminum finished goods: device-tree base, lamp, care cart, bed frame, storage cabinet. Fixed prices order directly; sized builds are quoted.',
      jp: 'アルミ完成品：デバイスツリーベース、ランプ、ケアワゴン、ベッド、収納庫。固定価格は直接注文、寸法品は見積。',
    },
    coverImage: '',
    accent: 'amber',
    items: FURNITURE_ITEMS,
  },
  {
    id: 'samples',
    title: { cn: '样品购买', en: 'Sample Packs', jp: 'サンプル購入' },
    eyebrow: { cn: 'See before you order', en: 'See before you order', jp: '注文前に確認' },
    description: {
      cn: '色板、样段、样板。先寄样再签单，比事后扯色差便宜得多。',
      en: 'Swatches, profile offcuts and plate samples. Ship first, sign later — cheaper than arguing about color.',
      jp: '色見本・端材・板サンプル。先に送ってから受注。色違いの揉め事より安い。',
    },
    coverImage: '',
    accent: 'blue',
    items: SAMPLE_ITEMS,
  },
];

export const STOREFRONT_ITEMS: StorefrontItem[] = STOREFRONT_SECTIONS.flatMap(section => section.items);

export const findStorefrontSection = (id: string | undefined) =>
  STOREFRONT_SECTIONS.find(section => section.id === id);

export const findStorefrontItem = (id: string | undefined) =>
  STOREFRONT_ITEMS.find(item => item.id === id);

/** 价格展示：区间价显示起价，固定价显示单价 */
export const storefrontPriceLabel = (item: StorefrontItem, language: Language) => {
  const currency = language === 'cn' ? '¥' : '$';
  if (item.purchase === 'quote') {
    if (item.priceFrom != null && item.priceTo != null) {
      return `${currency}${item.priceFrom}–${item.priceTo}`;
    }
    return language === 'cn' ? '询价' : language === 'jp' ? '見積' : 'Quote';
  }
  return `${currency}${Number(item.price ?? 0)}`;
};

export const storefrontUnitLabel = (item: StorefrontItem, language: Language) => {
  const map: Record<StorefrontItem['unit'], LocalizedText> = {
    pc: { cn: '/ 件', en: '/ pc', jp: '/ 点' },
    set: { cn: '/ 套', en: '/ set', jp: '/ セット' },
    pack: { cn: '/ 包', en: '/ pack', jp: '/ パック' },
  };
  return map[item.unit][language];
};
