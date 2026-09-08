import type { Language } from '../types';
import { END_CAP_PRICES } from '../utils/accessoryPricing';

export type AccessoryProfileSize = '1515' | '2020' | '3030' | '4040';
export type AccessoryColorMode = 'natural' | 'colored';

export interface AccessoryPrice {
  natural: number;
  colored: number;
  naturalBulk: number;
  coloredBulk: number;
}

export interface AccessoryDefinition {
  id: string;
  code: number;
  codeLabel?: Record<Language, string>;
  name: Record<Language, string>;
  note?: string;
  imageKey?: string;
  prices: Partial<Record<AccessoryProfileSize, AccessoryPrice>>;
}

export const ACCESSORY_IMAGE = '/images/accessory/accessory_codes.jpg';
export const ACCESSORY_CODE_IMAGE_MAP: Record<string, string> = {
  '1': '/images/accessory/1.jpg',
  '2': '/images/accessory/2.jpg',
  '3': '/images/accessory/3.jpg',
  '5': '/images/accessory/5.jpg',
  '7': '/images/accessory/7L.jpg',
  '7L': '/images/accessory/7L.jpg',
  '7T': '/images/accessory/7T.jpg',
  '8': '/images/accessory/8.jpg',
  '9': '/images/accessory/9.jpg',
  '10': '/images/accessory/10.jpg',
  '10_1515_m4x6_cap': '/images/accessory/10_1515_m4x6_cap.jpg',
  '10_1515_m4x10_cs': '/images/accessory/10_1515_m4x10_cs.jpg',
  '10_1515_m4x12_cap': '/images/accessory/10_1515_m4x12_cap.jpg',
  '10_1515_m4_tnut': '/images/accessory/10_1515_m4_tnut.jpg',
  '10_2020_m5x14_cap': '/images/accessory/10_2020_m5x14_cap.jpg',
  '10_2020_m5x8_cap': '/images/accessory/10_2020_m5x8_cap.jpg',
  '10_2020_m6x20_cs': '/images/accessory/10_2020_m6x20_cs.jpg',
  '10_2020_m5_tnut': '/images/accessory/10_2020_m5_tnut.jpg',
  '10_3030_m6x18_cap': '/images/accessory/10_3030_m6x18_cap.jpg',
  '10_3030_m6x12_cap': '/images/accessory/10_3030_m6x12_cap.jpg',
  '10_3030_m8x20_cs': '/images/accessory/10_3030_m8x20_cs.jpg',
  '10_3030_m6_tnut': '/images/accessory/10_3030_m6_tnut.jpg',
};

export const ACCESSORY_DEFINITIONS: AccessoryDefinition[] = [
  {
    id: '1',
    code: 1,
    name: { en: 'No.1 Corner Bracket + Screws', cn: '1号角码配螺丝', jp: '1番コーナーブラケット+ねじ' },
    prices: {
      '2020': { natural: 1, colored: 3, naturalBulk: 0.9, coloredBulk: 2.5 },
      '3030': { natural: 2, colored: 4, naturalBulk: 1.5, coloredBulk: 3.1 },
    },
  },
  {
    id: '2',
    code: 2,
    name: { en: 'No.2 Corner Bracket (Only)', cn: '2号角码 only', jp: '2番コーナーブラケットのみ' },
    prices: {
      '1515': { natural: 3, colored: 3.5, naturalBulk: 2.5, coloredBulk: 3 },
      '2020': { natural: 4, colored: 5, naturalBulk: 3.2, coloredBulk: 4 },
      '3030': { natural: 6, colored: 8, naturalBulk: 4.5, coloredBulk: 6 },
    },
  },
  {
    id: '5',
    code: 5,
    name: { en: 'No.5 Corner Bracket + Set Screw', cn: '5号角码配顶丝', jp: '5番コーナーブラケット+止めねじ' },
    prices: {
      '2020': { natural: 1, colored: 3, naturalBulk: 0.9, coloredBulk: 2.5 },
      '3030': { natural: 1.5, colored: 3.5, naturalBulk: 1.3, coloredBulk: 3.1 },
    },
  },
  {
    id: '7L',
    code: 7,
    imageKey: '7L',
    name: { en: 'No.7 Corner Bracket (L Type)', cn: '7号角码 L型', jp: '7番コーナーブラケット L型' },
    prices: {
      '1515': { natural: 3, colored: 3.5, naturalBulk: 2.5, coloredBulk: 3 },
      '2020': { natural: 3, colored: 3.5, naturalBulk: 2.5, coloredBulk: 3 },
      '3030': { natural: 4.5, colored: 5, naturalBulk: 3.5, coloredBulk: 4 },
      '4040': { natural: 6, colored: 8, naturalBulk: 4.5, coloredBulk: 6 },
    },
  },
  {
    id: '7T',
    code: 7,
    imageKey: '7T',
    name: { en: 'No.7 Corner Bracket (T Type)', cn: '7号角码 T型', jp: '7番コーナーブラケット T型' },
    prices: {
      '1515': { natural: 3, colored: 3.5, naturalBulk: 2.5, coloredBulk: 3 },
      '2020': { natural: 3, colored: 3.5, naturalBulk: 2.5, coloredBulk: 3 },
      '3030': { natural: 4.5, colored: 5, naturalBulk: 3.5, coloredBulk: 4 },
      '4040': { natural: 6, colored: 8, naturalBulk: 4.5, coloredBulk: 6 },
    },
  },
  {
    id: '9',
    code: 9,
    name: { en: 'No.9 Tee Connector', cn: '9号三通', jp: '9番T字コネクタ' },
    prices: {
      '1515': { natural: 3, colored: 4, naturalBulk: 2.5, coloredBulk: 3 },
      '2020': { natural: 4, colored: 5, naturalBulk: 3.5, coloredBulk: 4 },
      '3030': { natural: 6, colored: 7, naturalBulk: 5.5, coloredBulk: 6 },
    },
  },
  {
    id: 'end_cap_2020',
    code: 0,
    codeLabel: { en: 'End cap', cn: '端盖', jp: 'エンドキャップ' },
    name: { en: '2020 Aluminum Profile End Cap', cn: '2020铝型材端盖', jp: '2020アルミプロファイル端キャップ' },
    prices: {
      '2020': {
        natural: END_CAP_PRICES['2020'].retail,
        colored: END_CAP_PRICES['2020'].retail,
        naturalBulk: END_CAP_PRICES['2020'].bulk,
        coloredBulk: END_CAP_PRICES['2020'].bulk,
      },
    },
  },
  {
    id: 'end_cap_3030',
    code: 0,
    codeLabel: { en: 'End cap', cn: '端盖', jp: 'エンドキャップ' },
    name: { en: '3030 Aluminum Profile End Cap', cn: '3030铝型材端盖', jp: '3030アルミプロファイル端キャップ' },
    prices: {
      '3030': {
        natural: END_CAP_PRICES['3030'].retail,
        colored: END_CAP_PRICES['3030'].retail,
        naturalBulk: END_CAP_PRICES['3030'].bulk,
        coloredBulk: END_CAP_PRICES['3030'].bulk,
      },
    },
  },
  {
    id: '10_1515_m4x6_cap',
    code: 10,
    name: { en: 'No.10 Screw · 304 M4*6 Socket Cap', cn: '10号螺丝 · 304 M4*6 圆柱头内六角', jp: '10番ねじ · 304 M4*6 六角穴付きボルト' },
    note: '1515：搭配7号配件',
    prices: {
      '1515': { natural: 0.5, colored: 1, naturalBulk: 0.33, coloredBulk: 0.8 },
    },
  },
  {
    id: '10_1515_m4x12_cap',
    code: 10,
    name: { en: 'No.10 Screw · 304 M4*12 Socket Cap', cn: '10号螺丝 · 304 M4*12 圆柱头内六角', jp: '10番ねじ · 304 M4*12 六角穴付きボルト' },
    note: '1515：搭配2号配件',
    prices: {
      '1515': { natural: 0.5, colored: 1, naturalBulk: 0.33, coloredBulk: 0.8 },
    },
  },
  {
    id: '10_1515_m4x10_cs',
    code: 10,
    name: { en: 'No.10 Screw · 304 M4*10 Countersunk', cn: '10号螺丝 · 304 M4*10 沉头内六角', jp: '10番ねじ · 304 M4*10 皿六角' },
    note: '1515：搭配9号配件',
    prices: {
      '1515': { natural: 0.5, colored: 1, naturalBulk: 0.33, coloredBulk: 0.8 },
    },
  },
  {
    id: '10_1515_m4_tnut',
    code: 10,
    name: { en: 'No.10 · 304 1515 M4 T Nut', cn: '10号配件 · 304 1515 M4 T型螺母', jp: '10番部品 · 304 1515 M4 Tナット' },
    note: '1515：T型螺母',
    prices: {
      '1515': { natural: 0.5, colored: 1, naturalBulk: 0.33, coloredBulk: 0.8 },
    },
  },
  {
    id: '10_2020_m5x14_cap',
    code: 10,
    name: { en: 'No.10 Screw · 304 M5*14 Socket Cap', cn: '10号螺丝 · 304 M5*14 圆柱头内六角', jp: '10番ねじ · 304 M5*14 六角穴付きボルト' },
    note: '2020：搭配2号配件',
    prices: {
      '2020': { natural: 0.5, colored: 1, naturalBulk: 0.33, coloredBulk: 0.8 },
    },
  },
  {
    id: '10_2020_m5x8_cap',
    code: 10,
    name: { en: 'No.10 Screw · 304 M5*8 Socket Cap', cn: '10号螺丝 · 304 M5*8 圆柱头内六角', jp: '10番ねじ · 304 M5*8 六角穴付きボルト' },
    note: '2020：搭配7号配件',
    prices: {
      '2020': { natural: 0.5, colored: 1, naturalBulk: 0.33, coloredBulk: 0.8 },
    },
  },
  {
    id: '10_2020_m6x20_cs',
    code: 10,
    name: { en: 'No.10 Screw · 304 M6*20 Countersunk', cn: '10号螺丝 · 304 M6*20 沉头内六角', jp: '10番ねじ · 304 M6*20 皿六角' },
    note: '2020：搭配9号配件',
    prices: {
      '2020': { natural: 0.5, colored: 1, naturalBulk: 0.33, coloredBulk: 0.8 },
    },
  },
  {
    id: '10_2020_m5_tnut',
    code: 10,
    name: { en: 'No.10 · 304 2020 M5 T Nut', cn: '10号配件 · 304 2020 M5 T型螺母', jp: '10番部品 · 304 2020 M5 Tナット' },
    note: '2020：T型螺母',
    prices: {
      '2020': { natural: 0.5, colored: 1, naturalBulk: 0.33, coloredBulk: 0.8 },
    },
  },
  {
    id: '10_3030_m6x18_cap',
    code: 10,
    name: { en: 'No.10 Screw · 304 M6*18 Socket Cap', cn: '10号螺丝 · 304 M6*18 圆柱头内六角', jp: '10番ねじ · 304 M6*18 六角穴付きボルト' },
    note: '3030：搭配2号配件',
    prices: {
      '3030': { natural: 0.75, colored: 1.25, naturalBulk: 0.5, coloredBulk: 1 },
    },
  },
  {
    id: '10_3030_m6x12_cap',
    code: 10,
    name: { en: 'No.10 Screw · 304 M6*12 Socket Cap', cn: '10号螺丝 · 304 M6*12 圆柱头内六角', jp: '10番ねじ · 304 M6*12 六角穴付きボルト' },
    note: '3030：搭配7号配件',
    prices: {
      '3030': { natural: 0.75, colored: 1.25, naturalBulk: 0.5, coloredBulk: 1 },
    },
  },
  {
    id: '10_3030_m8x20_cs',
    code: 10,
    name: { en: 'No.10 Screw · 304 M8*20 Countersunk', cn: '10号螺丝 · 304 M8*20 沉头内六角', jp: '10番ねじ · 304 M8*20 皿六角' },
    note: '3030：搭配9号配件',
    prices: {
      '3030': { natural: 0.75, colored: 1.25, naturalBulk: 0.5, coloredBulk: 1 },
    },
  },
  {
    id: '10_3030_m6_tnut',
    code: 10,
    name: { en: 'No.10 · 304 3030 M6 T Nut', cn: '10号配件 · 304 3030 M6 T型螺母', jp: '10番部品 · 304 3030 M6 Tナット' },
    note: '3030：T型螺母',
    prices: {
      '3030': { natural: 0.75, colored: 1.25, naturalBulk: 0.5, coloredBulk: 1 },
    },
  },
  // 暂不提供（图片有但当前无完整单价）
  // { code: 3, ... }
  // { code: 4, ... }
  // { code: 6, ... }
  // { code: 8, ... }
];

