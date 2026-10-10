/**
 * One picture identity for the designer's connection accessories.
 *
 * The customer-facing accessory section (quick quote / cart / factory sheet)
 * identifies every bracket by its own photograph through
 * `ACCESSORY_CODE_IMAGE_MAP`. The 3D designer library used to draw a generic
 * wrench glyph instead, so a customer could not tell which physical part
 * "1号角码" or "2号角码" actually meant. Both surfaces now resolve the same
 * catalogue key from this single table — if a picture is ever replaced in the
 * accessory section, the designer follows automatically.
 */
import { ACCESSORY_CODE_IMAGE_MAP } from '../data/accessoryCatalog';
import type { DIYConnectionKind } from './stoolDesignerEngine';

/** Designer library kind → accessory catalogue image key (No.1 / No.2 / …). */
export const CONNECTION_ACCESSORY_IMAGE_KEY: Record<DIYConnectionKind, string> = {
  connector: '1',
  extruded_connector: '2',
  hidden_connector: '5',
  l_connector: '7L',
  t_connector: '7T',
  tee_connector: '9',
};

/**
 * Resolves the catalogue picture for a designer connection kind. Returns an
 * empty string when the catalogue has no photo for it, so callers keep their
 * icon fallback instead of rendering a broken image.
 */
export const getConnectionAccessoryImageSrc = (kind: DIYConnectionKind): string => (
  ACCESSORY_CODE_IMAGE_MAP[CONNECTION_ACCESSORY_IMAGE_KEY[kind]] || ''
);
