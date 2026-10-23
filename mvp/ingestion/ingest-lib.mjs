import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

const MIME_BY_SIGNATURE=[
  {mime:'application/pdf',bytes:[0x25,0x50,0x44,0x46]},
  {mime:'image/png',bytes:[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]},
  {mime:'image/jpeg',bytes:[0xff,0xd8,0xff]},
  {mime:'image/svg+xml',text:'<svg'}
];
const ALLOWED_MIME=new Set(MIME_BY_SIGNATURE.map(rule=>rule.mime));

export function assertApprovedSource(source){
  const missing=['id','rightsStatus','termsSnapshotAt','robotsSnapshotAt','allowedPathPrefixes'].filter(key=>source?.[key]===undefined||source?.[key]===null);
  if(missing.length)throw new Error(`Source missing required preflight evidence: ${missing.join(', ')}`);
  if(source.rightsStatus!=='approved')throw new Error('Source is not approved for ingestion.');
  if(!Array.isArray(source.allowedPathPrefixes)||!source.allowedPathPrefixes.length)throw new Error('Source has no allowlisted paths.');
}
export function assertCrawlCandidate(source,url){
  assertApprovedSource(source);const candidate=new URL(url);const origin=new URL(source.baseUrl);
  if(candidate.protocol!=='https:'||candidate.origin!==origin.origin)throw new Error('Crawler may only fetch same-origin HTTPS URLs.');
  if(!source.allowedPathPrefixes.some(prefix=>candidate.pathname.startsWith(prefix)))throw new Error('Candidate URL is outside approved path allowlist.');
  return candidate;
}
export async function inspectUpload(filePath,maxBytes=40*1024*1024){
  const metadata=await stat(filePath);if(metadata.size===0||metadata.size>maxBytes)throw new Error('File exceeds ingestion size policy.');
  const buffer=await readFile(filePath);const mime=detectMime(buffer);if(!ALLOWED_MIME.has(mime))throw new Error('Unsupported or mismatched file signature.');
  return {mime,byteSize:metadata.size,sha256:createHash('sha256').update(buffer).digest('hex')};
}
function detectMime(buffer){
  for(const rule of MIME_BY_SIGNATURE){if(rule.bytes&&rule.bytes.every((byte,index)=>buffer[index]===byte))return rule.mime;if(rule.text&&buffer.subarray(0,1024).toString('utf8').toLowerCase().includes(rule.text))return rule.mime}return 'application/octet-stream';
}
