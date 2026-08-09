import React from 'react';
import { Language } from '../types';

const COPY: Record<Language, { title: string; natural: string; colored: string }> = {
  cn: {
    title: '截面本色与截面彩色',
    natural: '截面本色：型材切断后，端面保留铝材的银白本色。',
    colored: '截面彩色：型材表面和切割端面均为所选颜色。',
  },
  en: {
    title: 'Natural vs. colored cut ends',
    natural: 'Natural section: the cut end keeps the silver aluminum color.',
    colored: 'Colored section: both the profile surface and cut end use the selected color.',
  },
  jp: {
    title: 'ナチュラル断面とカラー断面',
    natural: 'ナチュラル断面：切断面はアルミ本来の銀白色のままです。',
    colored: 'カラー断面：プロファイル表面と切断面を選択色で仕上げます。',
  },
};

const ProfileSectionGuide: React.FC<{ language: Language }> = ({ language }) => {
  const copy = COPY[language];

  return (
    <aside className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:flex-row sm:items-center">
      <img
        src="/images/profile-section-natural-vs-colored.jpg"
        alt={copy.title}
        loading="lazy"
        decoding="async"
        className="h-36 w-full shrink-0 rounded-xl border border-amber-100 object-cover sm:h-28 sm:w-28"
      />
      <div className="space-y-1.5 text-sm text-slate-600">
        <h4 className="font-black text-slate-800">{copy.title}</h4>
        <p>{copy.natural}</p>
        <p>{copy.colored}</p>
      </div>
    </aside>
  );
};

export default ProfileSectionGuide;
