import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import requirejs from 'requirejs';
const require=createRequire(import.meta.url);
const expected=['createEditor','ImageEditor','ImageEngine','supportedLocales','defineCustomElement'];
function verify(api){for(const key of expected)assert.ok(api[key],`Missing export ${key}`);assert.equal(api.supportedLocales.length,16);assert.equal(api.shapeKinds.length,12);const engine=new api.ImageEngine();assert.equal(engine.canUndo,false);engine.destroy();}
test('ESM and CommonJS expose equivalent APIs without DOM globals',async()=>{const esm=await import('../dist/index.js');const cjs=require('../dist/index.cjs');verify(esm);verify(cjs);assert.deepEqual(Object.keys(esm).sort(),Object.keys(cjs).sort());assert.ok(require('icimg/engine').ImageEngine);});
test('AMD loads through genuine RequireJS and leaves browser global untouched',async()=>{const loader=requirejs.config({context:'icimg-amd-test',baseUrl:new URL('../dist/',import.meta.url).pathname,nodeRequire:require});const api=await new Promise((resolve,reject)=>loader(['icimg.amd'],resolve,reject));verify(api);assert.equal(globalThis.ICImg,undefined);});
test('global script attaches only ICImg, even when an AMD loader is present',async()=>{const code=await readFile(new URL('../dist/icimg.global.js',import.meta.url),'utf8');const context=vm.createContext({EventTarget,define(){throw Error('Global build must not use AMD');}});vm.runInContext(code,context);verify(context.ICImg);assert.deepEqual(Object.keys(context).sort(),['EventTarget','ICImg','define']);});
test('UMD selects CommonJS, AMD and browser global branches',async()=>{const code=await readFile(new URL('../dist/icimg.umd.js',import.meta.url),'utf8');verify(require('icimg/umd'));let factory;const define=(dependencies,fn)=>{assert.equal(dependencies.length,0);factory=fn;};define.amd={};const amd=vm.createContext({EventTarget,define});vm.runInContext(code,amd);assert.equal(amd.ICImg,undefined);verify(vm.runInContext(`(${factory.toString()})()`,amd));const global=vm.createContext({EventTarget});vm.runInContext(code,global);verify(global.ICImg);});
