import test from 'node:test'
import assert from 'node:assert/strict'
import {setTimeout as delay} from 'node:timers/promises'
import {createServerTemplateSync} from '../vendor/upstream/tavern-plugin/lib/domain/server-template-sync.js'

test('a stale template save retries against fresh state even without another scheduling event',async()=>{
 let attempts=0;const errors=[]
 const sync=createServerTemplateSync({delayMs:5,maxRetryDelayMs:10,run:async()=>{if(++attempts===1)throw Object.assign(new Error('stale state'),{code:'PROMPT_TEMPLATE_STATE_CONFLICT'});return {synchronized:true}},onError:e=>errors.push(e.code)})
 try{sync.schedule('test',1);for(let i=0;i<50&&attempts<2;i++)await delay(5);assert.equal(attempts,2);assert.deepEqual(errors,['PROMPT_TEMPLATE_STATE_CONFLICT']);await delay(25);assert.equal(attempts,2)}finally{sync.dispose()}
})
test('ordinary template errors are reported without an automatic retry loop',async()=>{
 let attempts=0;const sync=createServerTemplateSync({delayMs:5,run:async()=>{attempts++;throw Error('invalid template')}})
 try{sync.schedule('test',1);await delay(40);assert.equal(attempts,1)}finally{sync.dispose()}
})
