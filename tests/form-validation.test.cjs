const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../public/js/app.js'),'utf8');
function form(values={}){const data={date:'2000-02-29',time:'00:00',lat:'0',lon:'0',utc:'5.75',name:'Test',...values};const box={$:id=>({value:data[id.slice(1)],checked:false}),julianDay:()=>2451545};vm.createContext(box);vm.runInContext(src.slice(src.indexOf('function readForm()'),src.indexOf('function calc(')),box);return box.readForm();}
test('accepts midnight and fractional UTC',()=>{const f=form();assert.equal(f.hh,0);assert.equal(f.utc,5.75);});
for(const value of [{date:'2001-02-29'},{date:'2000-13-01'},{time:'24:00'},{time:'12:60'},{lat:'91'},{lon:'-181'},{utc:'NaN'},{utc:'15'}])test('rejects invalid '+JSON.stringify(value),()=>assert.throws(()=>form(value)));
