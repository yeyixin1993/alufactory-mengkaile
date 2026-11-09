import assert from 'node:assert/strict';
import { getProfileModelLabel } from '../utils/profileModelLabel';
import { PROFILE_VARIANTS } from '../constants';

// 车间看的中文名：字母缩写展开，封边型号带「封」。
const expectedCn: Record<string, string> = {
  '2020-N4-RD': '2020 N4 圆形',
  '2020-N4-SQ': '2020 N4 方形',
  '2020-N2-OPP': '2020 N2 对边',
  '2040-N1-20': '2040 N1-20封',
  '2040-N1-40': '2040 N1-40封',
  '3060-N1-60': '3060 N1-60封',
  '2040': '2040',
  '2020-N1': '2020 N1',
  '2020-N2': '2020 N2',
  '3030R': '3030R',
};

for (const [id, label] of Object.entries(expectedCn)) {
  assert.equal(getProfileModelLabel(id, 'cn'), label, `cn label for ${id}`);
}

// 英文/日文只翻译截面形状，封边标记跟随语言。
assert.equal(getProfileModelLabel('2020-N4-RD', 'en'), '2020 N4 Round');
assert.equal(getProfileModelLabel('2020-N4-SQ', 'jp'), '2020 N4 角形');
assert.equal(getProfileModelLabel('2040-N1-20', 'en'), '2040 N1-20 Sealed');
assert.equal(getProfileModelLabel('2040-N1-40', 'en'), '2040 N1-40 Sealed');
assert.equal(getProfileModelLabel('3060-N1-60', 'jp'), '3060 N1-60封');

// 每个目录型号都必须有可读标签，不能回退成空或 "-"。
for (const variant of PROFILE_VARIANTS) {
  const label = getProfileModelLabel(variant.id, 'cn');
  assert.ok(label && label !== '-', `label for catalog id ${variant.id}`);
  assert.ok(!label.includes('undefined'), `label for catalog id ${variant.id}`);
}

// 未知型号原样打印，绝不丢代码。
assert.equal(getProfileModelLabel('9999-XY', 'cn'), '9999-XY');
assert.equal(getProfileModelLabel(null, 'cn'), '-');

console.log(`Verified model labels for ${PROFILE_VARIANTS.length} catalog profiles (shape spelling + 封 mark).`);
