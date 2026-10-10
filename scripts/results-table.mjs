import fs from 'node:fs/promises';
// Public summary fields only. Escape Markdown/HTML so names remain plain text.
const cell=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\|/g,'&#124;').replace(/[\r\n]+/g,' ').replace(/([\\`*_\[\]])/g,'\\$1');
const {results=[]}=JSON.parse(await fs.readFile(new URL('../docs/results.json',import.meta.url),'utf8'));
const rows=results.map((r,i)=>`| ${i+1} | ${cell(r.name)} | ${cell(r.score)} / ${cell(r.maxScore)} | ${cell(r.gradingStatus)} | ${cell(r.pendingQuestions)} | ${cell(r.submittedAt)} | ${cell(r.updatedAt)} |`);
const table=['# Student results','', 'Submitted attempts are listed separately, including repeat attempts. Scores awaiting teacher review are provisional. Timestamps are in UTC.','', '| Attempt | Student name | Score | Grading status | Answers awaiting review | Submitted (UTC) | Last updated (UTC) |','| --- | --- | --- | --- | --- | --- | --- |',...rows,'',...(rows.length?[]:['No submitted results yet.','']),'This table is generated from [results.json](results.json) after each results update. Detailed answers and teacher feedback remain in encrypted records.',''];
await fs.writeFile(new URL('../docs/RESULTS.md',import.meta.url),table.join('\n'));
console.log(`Updated results table: ${results.length} submitted attempts.`);
