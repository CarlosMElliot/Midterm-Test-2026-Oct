import {execFileSync} from 'node:child_process';
if(process.env.VERCEL_GIT_COMMIT_REF==='exam-data')process.exit(0);
try{const paths=execFileSync('git',['diff','--name-only','HEAD^','HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);process.exit(paths.length&&paths.every(p=>p==='docs/results.json'||p==='docs/RESULTS.md'||p.startsWith('exam-records/')||p.startsWith('exam-config/'))?0:1);}catch{process.exit(1);}
