// Refuse browser verification writes unless the actual API confirms a disposable LocalDB target.
const {execFileSync}=require('node:child_process');
module.exports=function requireIsolatedTestTarget() {
 const api=process.env.ESHAM_TEST_API || process.env.ESHAM_API_URL || 'http://localhost:5216';
 const frontend=process.env.ESHAM_TEST_FRONTEND || process.env.ESHAM_FRONTEND_URL || 'http://localhost:5175';
 for(const key of ['ESHAM_TEST_API','ESHAM_API_URL']) if(process.env[key] && new URL(process.env[key]).port!=='5216') throw new Error('Shared targets are forbidden.');
 for(const key of ['ESHAM_TEST_FRONTEND','ESHAM_FRONTEND_URL']) if(process.env[key] && new URL(process.env[key]).port!=='5175') throw new Error('Shared targets are forbidden.');
 const target=new URL(api),web=new URL(frontend);
 if(!['localhost','127.0.0.1'].includes(target.hostname)||target.port!=='5216'
   ||!['localhost','127.0.0.1'].includes(web.hostname)||web.port!=='5175')
   throw new Error('Verification is restricted to the isolated API 5216 and frontend 5175. Shared targets are forbidden.');
 const script=`(async()=>{const [r,module]=await Promise.all([fetch(process.argv[1]+'/development/test-isolation',{signal:AbortSignal.timeout(5000)}),fetch(process.argv[2]+'/src/services/accountApi.js',{signal:AbortSignal.timeout(5000)})]);if(!r.ok||(await r.json()).isolated!==true)process.exit(2);const source=await module.text(),match=source.match(/["']VITE_API_BASE_URL["']\\s*:\\s*["']([^"']+)["']/);if(!match||new URL(match[1]).origin!==new URL(process.argv[1]).origin)process.exit(4)})().catch(()=>process.exit(3))`;

 try {execFileSync(process.execPath,['-e',script,api,frontend],{stdio:'pipe',timeout:8000});}
 catch {throw new Error('Refusing verification: API did not confirm an isolated LocalDB Esham_AccountTests_* database.');}
};
