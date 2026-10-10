import crypto from 'node:crypto';
export function validate(exam){
 const errors=[]; if(!Array.isArray(exam.sections)||!exam.sections.length)return ['Sections required'];
 if(exam.sections.reduce((n,s)=>n+Number(s.weight),0)!==100)errors.push('Section weights must total 100');
 const ids=new Set(); for(const s of exam.sections){
 if(!s.id||!s.title||!Number.isFinite(s.weight)||s.weight<=0)errors.push('Invalid section');
 if(s.blocker)errors.push(`${s.title}: ${s.blocker}`);
 if(!s.questions?.length)errors.push(`${s.title}: questions required`);
 for(const q of s.questions||[]){if(ids.has(q.id)||!q.id)errors.push('Question IDs must be unique');ids.add(q.id);
 if(!['choice','text','essay'].includes(q.type)||!q.prompt||!Number.isFinite(q.max)||q.max<=0)errors.push(`${q.id}: invalid question`);
 if(q.type==='choice'&&(!Array.isArray(q.options)||q.options.length<2||(q.answer!==null&&(!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.options.length))))errors.push(`${q.id}: invalid choices/key`);
 }}return errors;
}
export function score(a){let total=0,pending=0;const sections=a.exam.sections.map(s=>{let earned=0,max=0;const questions=s.questions.map(q=>{max+=q.max;const response=a.answers[q.id];let points=null;
 if(a.grades[q.id]!==undefined)points=a.grades[q.id];else if(response===undefined||response==='')points=0;else if(q.type==='choice'&&q.answer!==null)points=response===q.answer?q.max:0;
 if(points===null)pending++;else earned+=points;return {id:q.id,prompt:q.prompt,response:response??'',chosen:q.type==='choice'?q.options[response]??'':response??'',correct:q.type==='choice'?q.options[q.answer]??'Teacher review':q.answer??'Teacher review',points,max:q.max};});const weighted=max?earned/max*s.weight:0;total+=weighted;return {title:s.title,weight:s.weight,earned:weighted,questions};});return {total:Math.round(total*100)/100,pending,final:pending===0,sections};}
export function publicExam(exam){return {...exam,sections:exam.sections.map(({blocker,reviewNote,...s})=>({...s,questions:s.questions.map(({answer,...q})=>q)}))};}
export function encrypt(value,key){const iv=crypto.randomBytes(12);const c=crypto.createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);const data=Buffer.concat([c.update(JSON.stringify(value)),c.final()]);return {version:1,algorithm:'AES-256-GCM',iv:iv.toString('base64'),tag:c.getAuthTag().toString('base64'),data:data.toString('base64')};}
export function report(a){const r=score(a);return [`Midterm results — ${a.name}`,`Started: ${a.startedAt}`,`Submitted: ${a.submittedAt||'Not submitted'}`,`${r.final?'Final':'Provisional'} score: ${r.total}/100; pending review: ${r.pending}`,`Focus incidents: ${a.violations}`,a.feedback||'',...r.sections.flatMap(s=>[`\n${s.title} (${s.earned.toFixed(2)}/${s.weight})`,...s.questions.map(q=>`${q.prompt}\nAnswer: ${q.chosen}\nExpected: ${q.correct}\nPoints: ${q.points??'Pending'}/${q.max}`)])].join('\n');}

// Explicit allow-list: never publish answers, answer keys, email or teacher feedback.
export function publicResults(attempts){return attempts.filter(a=>a.status==='submitted').map(a=>{const r=score(a);return {name:a.name,score:r.total,maxScore:100,gradingStatus:r.final?'Final':'Awaiting teacher review',pendingQuestions:r.pending,submittedAt:a.submittedAt,updatedAt:a.updatedAt};}).sort((a,b)=>b.submittedAt.localeCompare(a.submittedAt));}
