import type { Language } from '../types';
import { PROFILE_VARIANTS } from '../constants';

/**
 * Factory-facing model label.
 *
 * The workshop reads Chinese, so the three letter-coded section shapes are
 * spelled out exactly the way Quick Quote already shows them ("2020 N4 圆形")
 * instead of the raw catalog id ("2020-N4-RD"). Every other code — N1, N2,
 * N1-60 and so on — keeps its letters; only the spelling follows the catalog
 * name, which is what Quick Quote prints.
 */
const SHAPE_SUFFIX: Record<string, Record<Language, string>> = {
  RD: { cn: '圆形', en: 'Round', jp: '丸形' },
  SQ: { cn: '方形', en: 'Square', jp: '角形' },
  OPP: { cn: '对边', en: 'Opposite', jp: '対辺' },
};

const VARIANT_NAMES = new Map(PROFILE_VARIANTS.map((variant) => [variant.id, variant.name]));

/**
 * Variants shipped with a sealed (groove-free) face. The workshop calls them
 * "封" — `2040 N1-20封`, `2040 N1-40封`, `3060 N1-60封` — so the mark is
 * appended to the printed model, not to the catalog name (Quick Quote keeps
 * its own wording).
 */
const SEALED_FACE_IDS = new Set(['2040-N1-20', '2040-N1-40', '3060-N1-60']);
const SEALED_MARK: Record<Language, string> = { cn: '封', en: ' Sealed', jp: '封' };

const sealedMarkFor = (id: string, language: Language): string =>
  SEALED_FACE_IDS.has(id) ? SEALED_MARK[language] : '';

/**
 * `2020-N4-RD` → `2020 N4 圆形` (cn) / `2020 N4 Round` (en).
 * `2040-N1-20` → `2040 N1-20封`; `2040-N1-40` → `2040 N1-40封`.
 * Unknown ids are printed unchanged so a new catalog entry never loses its code.
 */
export const getProfileModelLabel = (
  variantId: string | null | undefined,
  language: Language = 'cn',
): string => {
  const id = String(variantId ?? '').trim();
  if (!id) return '-';

  const suffix = id.split('-').pop()?.toUpperCase() || '';
  const shape = SHAPE_SUFFIX[suffix];
  const catalogName = VARIANT_NAMES.get(id);
  const sealed = sealedMarkFor(id, language);
  if (!catalogName) return `${id}${sealed}`;
  if (!shape) return `${catalogName}${sealed}`;

  const base = catalogName.replace(shape.cn, '').trim();
  return language === 'cn' ? `${catalogName}${sealed}` : `${base} ${shape[language]}${sealed}`;
};
