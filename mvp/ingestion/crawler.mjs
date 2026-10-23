import { createHash } from 'node:crypto';
import { assertCrawlCandidate } from './ingest-lib.mjs';

const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

/**
 * Fetch one approved public candidate without persisting it. A caller must record the
 * returned audit object, run malware/extraction checks, and obtain review before Storage upload.
 */
export async function fetchApprovedCandidate(source,url,{maxBytes=40*1024*1024,minDelayMs=1000,fetchImpl=fetch}={}){
  const candidate=assertCrawlCandidate(source,url);
  if(source.lastRequestAt){const remaining=minDelayMs-(Date.now()-new Date(source.lastRequestAt).getTime());if(remaining>0)await sleep(remaining)}
  const startedAt=new Date().toISOString();
  const response=await fetchImpl(candidate,{redirect:'manual',headers:{'user-agent':'GarageAtlasIngestion/0.1 (approval-required)'}});
  if([401,403,429].includes(response.status))throw new Error(`Terminal crawl response ${response.status}; do not bypass access controls.`);
  if(response.status<200||response.status>=300)throw new Error(`Unexpected crawl response ${response.status}.`);
  const headerLength=Number(response.headers.get('content-length')||0);if(headerLength>maxBytes)throw new Error('Response exceeds byte budget.');
  const declaredMime=(response.headers.get('content-type')||'').split(';')[0].toLowerCase();
  if(!['application/pdf','image/png','image/jpeg','image/svg+xml'].includes(declaredMime))throw new Error(`Unsupported declared MIME: ${declaredMime||'missing'}.`);
  const reader=response.body?.getReader();if(!reader)throw new Error('Response body unavailable.');
  const chunks=[];let bytes=0;const hash=createHash('sha256');
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maxBytes){await reader.cancel();throw new Error('Stream exceeded byte budget.')}hash.update(value);chunks.push(value)}
  return {url:candidate.toString(),startedAt,status:response.status,mimeType:declaredMime,byteSize:bytes,sha256:hash.digest('hex'),body:Buffer.concat(chunks),audit:{termsSnapshotAt:source.termsSnapshotAt,robotsSnapshotAt:source.robotsSnapshotAt,rightsStatus:source.rightsStatus}};
}
