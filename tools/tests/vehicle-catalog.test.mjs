import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const paths = ['apps/admin/lib/vehicleCatalog.ts', 'apps/web/lib/vehicleCatalog.ts'];
const sources = paths.map(path => fs.readFileSync(path, 'utf8'));
const mod = { exports: {} };
new Function('exports', 'module', ts.transpileModule(sources[0], { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(mod.exports, mod);
const { VEHICLE_CATALOG, getBrandsForType, getModelsForBrand, resolveCatalogBrand } = mod.exports;
test('web and sales offer the same catalog', () => assert.equal(sources[0], sources[1]));
test('every category exposes nonempty models without duplicate brands or models', () => {
  assert.deepEqual(Object.keys(VEHICLE_CATALOG).sort(), ['AUTO', 'CARGO', 'MOTO', 'MOTOTAXI', 'VAN']);
  for (const type of Object.keys(VEHICLE_CATALOG)) {
    const brands = getBrandsForType(type);
    assert.equal(new Set(brands.map(b => b.toLowerCase())).size, brands.length);
    for (const brand of brands) {
      const models = getModelsForBrand(type, brand);
      assert(models.length > 0, `${type}/${brand}`);
      assert(models.every(model => model.trim() === model && model.length > 0));
      assert.equal(new Set(models.map(m => m.toLowerCase())).size, models.length, `${type}/${brand}`);
      assert.deepEqual(getModelsForBrand(type, ` ${brand.toUpperCase()} `), models);
    }
  }
});
test('Suzuki is selectable in all applicable categories', () => {
  for (const type of ['AUTO', 'MOTO', 'VAN', 'CARGO']) {
    assert(getBrandsForType(type).includes('Suzuki'));
    assert.equal(resolveCatalogBrand(type, ' SUZUKI '), 'Suzuki');
  }
  for (const model of ['Swift', 'Vitara', 'Jimny']) assert(getModelsForBrand('AUTO', 'Suzuki').includes(model));
  for (const model of ['GN 125', 'Gixxer 150', 'GSX-R150 ABS', 'GZ 150']) assert(getModelsForBrand('MOTO', 'Suzuki').includes(model));
});
test('unlisted brands retain their value for manual entry', () => {
  assert.equal(resolveCatalogBrand('AUTO', ' Marca importada '), 'Marca importada');
  assert.deepEqual(getModelsForBrand('AUTO', 'Marca importada'), []);
  assert.deepEqual(getModelsForBrand('MOTO', ''), []);
});
