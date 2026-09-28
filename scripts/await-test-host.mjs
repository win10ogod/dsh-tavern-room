import {readFile} from 'node:fs/promises'
export async function testHostUrl(){
 const end=Date.now()+90000
 while(Date.now()<end){const log=await readFile(new URL('../artifacts/test-server.log',import.meta.url),'utf8').catch(()=>''),match=log.match(/http:\/\/127\.0\.0\.1:3197\/\?token=[^\s]+/u);if(match)return match[0];await new Promise(resolve=>setTimeout(resolve,500))}
 throw new Error('Test DSH did not become ready')
}
