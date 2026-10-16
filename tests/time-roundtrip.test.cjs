const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../public/js/app.js'),'utf8');
function context(query='') {
 const elements={}; const $=key=>elements[key] ||= {value:'',checked:false,options:[],appendChild(o){this.options.push(o)},click(){}};
 const ctx={$ ,URLSearchParams,location:{search:query},document:{createElement:()=>({})},renderSaved(){}};
 vm.createContext(ctx);
 vm.runInContext(src.slice(src.indexOf('function restoreTimezone('),src.indexOf('// ---------- Восстановление из URL')),ctx);
 return {ctx,$};
}
for(const offset of [0,3,5.5,5.75,-3.5,-9.5,12.75]) for(const dst of [false,true]) test(`timezone round trip ${offset}, DST ${dst}`,()=>{
 const {ctx,$}=context(); ctx.restoreTimezone(offset,dst); assert.equal(Number($('#utc').value)+($('#dst').checked?1:0),offset); assert.equal($('#dst').checked,dst);
});
for(const hour of [0,12,23]) for(const minute of [0,30]) test(`share restoration preserves ${hour}:${minute}`,()=>{
 const {ctx,$}=context(`?fy=2000&fm=1&fd=1&fh=${hour}&fmn=${minute}&tz=5.75`);
 vm.runInContext(src.slice(src.indexOf('(function fromUrl()'),src.indexOf('// Значения по умолчанию')),ctx);
 assert.equal($('#time').value,`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`);
 assert.equal(Number($('#utc').value),5.75); assert.equal($('#dst').checked,false);
});
test('saved-open uses exact effective offset and explicit DST',()=>{
 const {ctx,$}=context(); const record={name:'Test',y:2000,m:1,d:1,hh:0,mm:30,city:'Test',lat:0,lon:0,utc:-3.5,dst:true};
 const start=src.indexOf('    const r = arr[+open.dataset.i];'); const end=src.indexOf("    $('#btnCalc').click();",start);
 ctx.arr=[record];ctx.open={dataset:{i:'0'}};vm.runInContext(src.slice(start,end),ctx);
 assert.equal($('#time').value,'00:30'); assert.equal(Number($('#utc').value)+1,-3.5); assert.equal($('#dst').checked,true);
});
