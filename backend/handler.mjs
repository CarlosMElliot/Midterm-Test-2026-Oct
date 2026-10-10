import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {createRepositoryStore,HttpError} from './github-store.mjs';
import {validate,publicExam,publicResults,score,report} from '../lib.mjs';
const initial=JSON.parse(await fs.readFile(new URL('../data/exam.json',import.meta.url),'utf8'));
const timestamp=()=>new Date().toISOString();
const sha=s=>crypto.createHash('sha256').update(String(s||'')).digest('hex');
const equal=(a,b)=>crypto.timingSafeEqual(Buffer.from(sha(a)),Buffer.from(sha(b)));
export function createHandler(env=process.env,store=createRepositoryStore(env),request=fetch){
 const cookieOptions=`; Path=/; HttpOnly; SameSite=Strict${env.VERCEL||env.NODE_ENV==='production'?'; Secure':''}`;
 function signature(payload){return crypto.createHmac('sha256',env.RESULTS_ENCRYPTION_KEY||'unconfigured').update('midterm-session:'+payload).digest('base64url');}
 function adminToken(){const payload=Buffer.from(JSON.stringify({exp:Date.now()+8*3600000,passwordVersion:sha(env.ADMIN_PASSWORD),nonce:crypto.randomBytes(16).toString('hex')})).toString('base64url');return payload+'.'+signature(payload);}
 function isAdmin(token){if(!env.ADMIN_PASSWORD||!/^[a-f0-9]{64}$/i.test(env.RESULTS_ENCRYPTION_KEY||''))return false;try{const [payload,sig]=String(token||'').split('.');if(!sig||!equal(sig,signature(payload)))return false;const data=JSON.parse(Buffer.from(payload,'base64url'));return data.exp>Date.now()&&data.passwordVersion===sha(env.ADMIN_PASSWORD);}catch{return false;}}
 function parseCookies(req){return Object.fromEntries((req.headers.cookie||'').split(/;\s*/).filter(Boolean).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));}
 function cookie(res,name,value){res.setHeader('Set-Cookie',`${name}=${value}; Max-Age=${value?86400:0}${cookieOptions}`);}
 function send(res,status,value){res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));}
 function file(id){if(!/^[a-f0-9]{32}$/.test(id||''))throw new HttpError(404,'Attempt not found');return `exam-records/attempt-${id}.json`;}
 async function config(){return (await store.read('exam-config/settings.json'))?.value||{exam:initial,open:false};}
 async function student(token){const [id,secret]=String(token||'').split('.');if(!id||!secret)throw new HttpError(401,'No active attempt');const a=(await store.read(file(id)))?.value;if(!a||!equal(a.secret,sha(secret)))throw new HttpError(401,'No active attempt');return a;}
 function open(a){if(!a)throw new HttpError(404,'Attempt not found');if(a.status!=='in_progress')throw new HttpError(409,a.status==='reset'?'This attempt was reset. Return to the beginning.':'This attempt is closed');}
 function change(a){a.updatedAt=timestamp();a.lastBackupAt=a.updatedAt;a.backupPending=false;return a;}
 async function publish(a){if(a.status!=='submitted')return;const summary=publicResults([a])[0];await store.mutate('docs/results.json',current=>{const rows=current?.results||[];const previous=rows.find(r=>r.attemptId===a.id);if(previous&&previous.updatedAt>=summary.updatedAt)return undefined;return {results:[...rows.filter(r=>r.attemptId!==a.id),{...summary,attemptId:a.id}].sort((a,b)=>b.submittedAt.localeCompare(a.submittedAt))};},{plain:true,onMain:true});}
 async function publishSafely(a){try{await publish(a);return null;}catch{return 'Attempt saved in the repository. Public results are awaiting sync; the teacher can retry from the dashboard.';}}
 async function readBody(req){if(req.body!==undefined){const b=typeof req.body==='string'?JSON.parse(req.body):req.body;if(JSON.stringify(b).length>250000)throw new HttpError(413,'Request too large');return b||{};}let text='';for await(const chunk of req){text+=chunk;if(text.length>250000)throw new HttpError(413,'Request too large');}return text?JSON.parse(text):{};}
 return async(req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');try{
  const url=new URL(req.url,'http://localhost');const path=url.searchParams.get('route')?'/api/'+url.searchParams.get('route'):url.pathname;const cookies=parseCookies(req);const method=req.method;
  // Only this submission route accepts the public GitHub Pages origin; admin routes stay same-origin.
  if(path==='/api/static-submit'){
   if(req.headers.origin!=='https://carlosmelliot.github.io')throw new HttpError(403,'Submission origin is not allowed.');
   res.setHeader('Access-Control-Allow-Origin','https://carlosmelliot.github.io');res.setHeader('Vary','Origin');
   res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
   if(method==='OPTIONS'){res.statusCode=204;return res.end();}
   if(method!=='POST')throw new HttpError(405,'Method not allowed');
   const b=await readBody(req),c=await config();if(!c.open||validate(c.exam).length)throw new HttpError(409,'The teacher has closed submissions.');
   if(b.examVersion!==c.exam.version)throw new HttpError(409,'This test version is no longer accepted. Download your response and contact your teacher.');
   if(!/^[a-f0-9-]{36}$/i.test(b.clientId||''))throw new HttpError(400,'Invalid attempt identifier');
   const name=String(b.name||'').trim();if(name.length<2||name.length>100)throw new HttpError(400,'Enter a valid name.');
   if(!b.answers||typeof b.answers!=='object'||Array.isArray(b.answers))throw new HttpError(400,'Answers required');
   const answers={};const questions=c.exam.sections.flatMap(s=>s.questions);
   for(const [qid,v] of Object.entries(b.answers)){const q=questions.find(q=>q.id===qid);if(!q||(q.type==='choice'?(!Number.isInteger(v)||v<0||v>=q.options.length):(typeof v!=='string'||v.length>20000)))throw new HttpError(400,'Invalid answer');answers[qid]=v;}
   const id=sha('github-pages-v2:'+b.clientId).slice(0,32),fingerprint=sha(JSON.stringify({name,answers:Object.fromEntries(Object.entries(answers).sort()),version:b.examVersion}));
   const a=await store.mutate(file(id),old=>{if(old){if(old.submissionFingerprint!==fingerprint)throw new HttpError(409,'This attempt has already been submitted with different answers.');return undefined;}const now=timestamp();return change({id,secret:sha(crypto.randomBytes(32)),name,source:'github-pages-v2',completionScoring:true,submissionFingerprint:fingerprint,startedAt:now,clientStartedAt:typeof b.startedAt==='string'?b.startedAt.slice(0,40):null,submittedAt:now,status:'submitted',exam:c.exam,answers,grades:{},position:0,violations:Number.isInteger(b.violations)?Math.max(0,Math.min(b.violations,3)):0,events:[{type:'submitted_from_github_pages',at:now}]});});
   const warning=await publishSafely(a);const result=score(a);return send(res,200,{ok:true,receipt:{id:a.id,submittedAt:a.submittedAt,score:result.total,maxScore:100,pendingQuestions:result.pending,completionCredit:result.completionCredit,gradingStatus:result.final?'Final':'Awaiting teacher review',repository:'CarlosMElliot/Midterm-Test-2026-Oct'},warning});
  }
  if(!['GET','POST'].includes(method))throw new HttpError(405,'Method not allowed');
  if(method==='POST'&&((req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)||req.headers['sec-fetch-site']==='cross-site'))throw new HttpError(403,'Cross-origin request blocked');
  const b=method==='POST'?await readBody(req):{};
  if(path==='/api/exam'){const c=await config();return send(res,200,{exam:publicExam(c.exam),open:c.open&&!validate(c.exam).length});}
  if(path==='/api/results'&&method==='GET')return send(res,200,(await store.read('docs/results.json',{plain:true,onMain:true}))?.value||{results:[]});
  if(path==='/api/login'&&method==='POST'){
   if(!env.ADMIN_PASSWORD||env.ADMIN_PASSWORD.length<16||!/^[a-f0-9]{64}$/i.test(env.RESULTS_ENCRYPTION_KEY||''))throw new HttpError(503,'Configure the admin password (16+ characters) and 64-hex encryption key in Vercel.');
   if(!equal(b.password,env.ADMIN_PASSWORD)){await new Promise(r=>setTimeout(r,800));throw new HttpError(401,'Incorrect password');}cookie(res,'admin',adminToken());return send(res,200,{ok:true});
  }
  if(path.startsWith('/api/admin')){
   if(!isAdmin(cookies.admin))throw new HttpError(401,'Sign in required');
   if(path==='/api/admin/logout'&&method==='POST'){cookie(res,'admin','');return send(res,200,{ok:true});}
   if(path==='/api/admin/config'&&method==='GET'){const c=await config();return send(res,200,{exam:c.exam,settings:{open:c.open},errors:validate(c.exam),backupReady:true,publicBackupReady:true,publicBackupError:null,emailReady:!!(env.RESEND_API_KEY&&env.MAIL_FROM),extraAudio:c.exam.extraAudio,storage:'github',dataBranch:store.branch});}
   if(path==='/api/admin/config'&&method==='POST'){const c=await store.mutate('exam-config/settings.json',old=>{const exam=b.exam||old?.exam||initial;const errors=validate(exam);if(b.open&&errors.length)throw new HttpError(400,errors.join('\n'));const structural=errors.filter(x=>!x.includes('questions required')&&!exam.sections?.some(s=>s.blocker&&x.includes(s.blocker)));if(structural.length)throw new HttpError(400,structural.join('\n'));return {exam,open:b.open===true};});return send(res,200,{ok:true,errors:validate(c.exam)});}
   if(path==='/api/admin/attempts'&&method==='GET'){const attempts=[];for(const id of await store.list()){const a=(await store.read(file(id)))?.value;if(a)attempts.push({id:a.id,name:a.name,status:a.status,startedAt:a.startedAt,updatedAt:a.updatedAt,submittedAt:a.submittedAt,violations:a.violations,score:score(a),lastBackupAt:a.updatedAt,backupPending:false});}return send(res,200,{attempts:attempts.sort((a,b)=>b.startedAt.localeCompare(a.startedAt))});}
   if(path==='/api/admin/sync'&&method==='POST'){let count=0;for(const id of await store.list()){const a=(await store.read(file(id)))?.value;if(a?.status==='submitted'){await publish(a);count++;}}return send(res,200,{ok:true,count});}
   const id=b.id||url.searchParams.get('id');const a=(await store.read(file(id)))?.value;if(!a)throw new HttpError(404,'Attempt not found');
   if(path==='/api/admin/attempt'&&method==='GET'){const {secret,...safe}=a;return send(res,200,{attempt:safe,score:score(a),report:report(a)});}
   if(path==='/api/admin/grade'&&method==='POST'){const updated=await store.mutate(file(id),current=>{if(!current)throw new HttpError(404,'Attempt not found');for(const [qid,v]of Object.entries(b.grades||{})){const q=current.exam.sections.flatMap(s=>s.questions).find(q=>q.id===qid);if(!q||!Number.isFinite(v)||v<0||v>q.max)throw new HttpError(400,'Invalid grade');}Object.assign(current.grades,b.grades);current.feedback=String(b.feedback||'').slice(0,10000);current.events.push({type:'graded',at:timestamp()});return change(current);});return send(res,200,{score:score(updated),report:report(updated),warning:await publishSafely(updated)});}
   if(path==='/api/admin/email'&&method==='POST'){
    if(!env.RESEND_API_KEY||!env.MAIL_FROM)throw new HttpError(503,'Email delivery is not configured. Download the report instead.');if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(b.email||'')||b.email.length>254)throw new HttpError(400,'Valid recipient email required');
    const sent=await request('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':sha(a.id+report(a)+b.email)},body:JSON.stringify({from:env.MAIL_FROM,to:[b.email],subject:`Midterm results: ${a.name}`,text:report(a)}),signal:AbortSignal.timeout(15000)});if(!sent.ok)throw new HttpError(502,`Email provider rejected delivery (${sent.status})`);
    await store.mutate(file(id),current=>{current.events.push({type:'email_sent',at:timestamp(),recipient:b.email});return change(current);});return send(res,200,{ok:true});
   }
   throw new HttpError(404,'Unknown admin operation');
  }
  if(path==='/api/start'&&method==='POST'){
   const c=await config();if(!c.open||validate(c.exam).length)throw new HttpError(409,'The teacher has not opened this test yet.');
   if(cookies.attempt){let current;try{current=await student(cookies.attempt);}catch(e){if(e.status!==401&&e.status!==404)throw e;}if(current?.status==='in_progress')throw new HttpError(409,'Resume your current attempt.');}
   const name=String(b.name||'').trim();if(name.length<2||name.length>100)throw new HttpError(400,'Enter your name (2–100 characters).');const id=crypto.randomBytes(16).toString('hex'),secret=crypto.randomBytes(32).toString('hex');
   await store.mutate(file(id),old=>{if(old)throw new HttpError(409,'Please retry starting the test');return change({id,secret:sha(secret),name,startedAt:timestamp(),status:'in_progress',exam:c.exam,answers:{},grades:{},position:0,violations:0,events:[]});});cookie(res,'attempt',id+'.'+secret);return send(res,200,{ok:true});
  }
  const a=await student(cookies.attempt);
  if(path==='/api/attempt'&&method==='GET')return send(res,200,{name:a.name,status:a.status,answers:a.answers,position:a.position,violations:a.violations,exam:publicExam(a.exam)});
  if(path==='/api/save'&&method==='POST'){
   await store.mutate(file(a.id),current=>{open(current);for(const [qid,v]of Object.entries(b.answers||{})){const q=current.exam.sections.flatMap(s=>s.questions).find(q=>q.id===qid);if(!q||(q.type==='choice'?(!Number.isInteger(v)||v<0||v>=q.options.length):(typeof v!=='string'||v.length>20000)))throw new HttpError(400,'Invalid answer');}Object.assign(current.answers,b.answers);if(Number.isInteger(b.position)&&b.position>=0&&b.position<1000)current.position=b.position;return change(current);});return send(res,200,{ok:true});
  }
  if(path==='/api/violation'&&method==='POST'){
   const current=await store.mutate(file(a.id),current=>{if(current?.status==='reset')return undefined;open(current);if(Date.now()-(current.lastViolation||0)>1500){current.lastViolation=Date.now();current.violations++;current.events.push({type:'focus_leave',at:timestamp(),reason:String(b.reason||'leave').slice(0,50)});}if(current.violations>=2)current.status='reset';return change(current);});if(current.status==='reset')cookie(res,'attempt','');return send(res,200,{restart:current.status==='reset',violations:current.violations});
  }
  if(path==='/api/submit'&&method==='POST'){
   const current=await store.mutate(file(a.id),current=>{if(current?.status==='submitted')return undefined;open(current);current.status='submitted';current.submittedAt=timestamp();current.events.push({type:'submitted',at:current.submittedAt});return change(current);});return send(res,200,{ok:true,warning:await publishSafely(current)});
  }
  throw new HttpError(404,'Unknown operation');
 }catch(e){return send(res,e.status||500,{error:e.status?e.message:'The request could not be completed. Please retry.',restart:e.message?.includes('was reset')||false});}};
}
