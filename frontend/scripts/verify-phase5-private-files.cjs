require('./require-isolated-test-target.cjs')();
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'../../artifacts/phase5-isolated'),pointer=fs.readFileSync(path.join(root,'current-fixture-path.txt'),'utf8').trim(),f=JSON.parse(fs.readFileSync(pointer,'utf8'));
 const recovery=path.join(root,'recovery',crypto.createHash('sha256').update(f.security.email).digest('hex').toUpperCase()+'.json');assert.ok(fs.existsSync(recovery));
 const checks=[];for(const [resource,file] of [['recovery',recovery],['fixture',pointer]]){const r=await fetch('http://localhost:5175/@fs/'+file.replaceAll('\\','/'),{method:'HEAD',redirect:'manual'});assert.ok([403,404].includes(r.status),'Private files must not be served by Vite');checks.push({resource,status:r.status,passed:true});}
 fs.writeFileSync(path.join(root,'private-http-probe.json'),JSON.stringify({passed:2,failed:0,checks}));console.log('PASS: recovery and fixture HTTP access blocked (2 checks; no bodies fetched)');
})().catch(()=>{console.error('FAIL: private file HTTP protection; no credentials printed');process.exitCode=1;});
