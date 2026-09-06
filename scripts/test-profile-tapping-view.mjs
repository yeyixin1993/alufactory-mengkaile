import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const result = await build({
  stdin: { contents: `export { default as Visualizer } from './components/ProfileVisualizer.tsx';
    export * from './utils/profileMachining.ts';`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'cjs', write: false,
});
const module = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const api = module.exports;
const flatten = node => !node || typeof node !== 'object' ? []
  : Array.isArray(node) ? node.flatMap(flatten)
    : [node, ...flatten(node.props?.children)];
let cases = 0;
for (const variantId of ['2020', '2040', '2040-N1-20', '2040-N1-40', '3060', '3060-N1-60', '4080', '2060', '20100', '2047']) {
  const count = api.getProfileTapPortCount(variantId);
  for (let physicalPort = 0; physicalPort < count; physicalPort++) {
    const config = { variantId, length: 500, colorId: 'natural', finish: 'oxidized',
      holes: [{ id: 'paired', side: 'B', positionMm: 100, type: 'through', physicalGrooveIndex: physicalPort }],
      tapping: { left: Array.from({length: count}, (_, i) => i === physicalPort), right: Array.from({length: count}, (_, i) => i === physicalPort) } };
    const original = JSON.stringify(config);
    const tapsBySide = {};
    for (const side of ['B', 'D']) {
      const calls = [];
      const nodes = flatten(api.Visualizer({ config, selectedSide: side, onSideChange() {}, tapLabel: '攻丝', interactive: true,
        onTapToggle: (...args) => calls.push(args) }));
      const taps = nodes.filter(n => n.props?.['data-physical-port'] === physicalPort);
      assert.equal(taps.length, 2);
      const expectedIndex = api.physicalGrooveToDisplay(side, physicalPort, count);
      for (const [index, end] of ['left', 'right'].entries()) {
        assert.equal(taps[index].props.style.top, `${(expectedIndex + 1) / (count + 1) * 100}%`);
        assert.equal(taps[index].props['data-tapped'], true);
        taps[index].props.onClick({ stopPropagation() {} });
        assert.deepEqual(calls[index], [end, physicalPort]);
      }
      // 2047 has three end ports but two wide-face slots; do not invent a
      // one-to-one correspondence there. Ordinary module arrays must match.
      if (count === api.getProfileGrooveCount(variantId, side)) {
        const hole = nodes.find(n => n.props?.['data-testid'] === 'profile-hole-paired');
        assert.equal(taps[0].props.style.top, hole.props.style.top);
      }
      tapsBySide[side] = parseFloat(taps[0].props.style.top);
    }
    assert.ok(Math.abs(tapsBySide.B + tapsBySide.D - 100) < 1e-9);
    assert.equal(JSON.stringify(config), original, 'Viewing/click callbacks must not mutate source data');
    cases++;
  }
  if (count > 1) for (const selectedSide of ['A', 'C']) {
    const nodes = flatten(api.Visualizer({ config: { variantId, length: 500, holes: [], tapping: {left: [], right: []} }, selectedSide, tapLabel: '攻丝' }));
    assert.equal(nodes.filter(n => n.props?.['data-physical-port'] !== undefined).length, 0);
  }
}
console.log(`PASS: ${cases} physical-port cases across B/D views, both-end click identity, drilling alignment, sealed variants and unchanged source arrays.`);
