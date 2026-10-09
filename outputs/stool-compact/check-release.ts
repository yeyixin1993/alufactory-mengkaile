import fs from 'node:fs';
import {normalizeDesignItems,inspectDesignerManufacturingPrecheck} from '../../components/DIYDesigner';
const d=JSON.parse(fs.readFileSync('outputs/stool-compact/凳子-精简版-角码方向修正版.json','utf8'));
console.log(JSON.stringify(inspectDesignerManufacturingPrecheck(normalizeDesignItems(d.items)),null,2));
