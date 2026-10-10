import fs from 'node:fs/promises';
const exam=JSON.parse(await fs.readFile(new URL('../data/exam.json',import.meta.url)));
if(exam.sections.reduce((n,s)=>n+s.weight,0)!==100)throw Error('Exam weights must total 100.');
console.log('Static student/admin assets ready. Vercel will bundle api/index.mjs separately.');
