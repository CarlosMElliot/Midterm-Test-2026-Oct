import fs from 'node:fs/promises';import crypto from 'node:crypto';
const [input,output]=process.argv.slice(2),key=process.env.RESULTS_ENCRYPTION_KEY;
if(!input||!output||!/^[a-f0-9]{64}$/i.test(key||''))throw Error('Usage: RESULTS_ENCRYPTION_KEY=<64hex> node scripts/decrypt.mjs input.json output.json');
const e=JSON.parse(await fs.readFile(input,'utf8'));const d=crypto.createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),Buffer.from(e.iv,'base64'));d.setAuthTag(Buffer.from(e.tag,'base64'));const value=JSON.parse(Buffer.concat([d.update(Buffer.from(e.data,'base64')),d.final()]));await fs.writeFile(output,JSON.stringify(value,null,2),{mode:0o600,flag:'wx'});console.log('Decrypted record saved. Keep this file private.');
