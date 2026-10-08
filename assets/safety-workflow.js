/* FLYMPUS shared safety workflow: explicit view vs acknowledgement; no implicit sign-off. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.FLYMPUS_SAFETY_WORKFLOW=api;
})(typeof window!=='undefined'?window:null,function(){
  const CLOSED=new Set(['RESOLVED','CLOSED']);
  function status(record){const s=String(record?.status||'OPEN').toUpperCase();return s==='IN_PROGRESS'||CLOSED.has(s)?s:'OPEN'}
  function isOpen(record){return !CLOSED.has(status(record))}
  function uid(value){return String(value||'').trim()}
  function recipientUids(record){return [...new Set((Array.isArray(record?.requiredAckUids)?record.requiredAckUids:[]).map(uid).filter(Boolean))]}
  function acknowledged(record,userId){const id=uid(userId);return Boolean(id&&record?.ackBy&&Object.prototype.hasOwnProperty.call(record.ackBy,id))}
  function viewed(record,userId){const id=uid(userId);return Boolean(id&&record?.seenBy&&Object.prototype.hasOwnProperty.call(record.seenBy,id))}
  function pending(record){return recipientUids(record).filter(id=>!acknowledged(record,id))}
  function progress(record){const total=recipientUids(record).length;return {total,acknowledged:total-pending(record).length,pending:pending(record).length}}
  function notification(record,userId){return recipientUids(record).includes(uid(userId))&&!acknowledged(record,userId)}
  function normalize(record){return {...record,status:status(record),requiredAckUids:recipientUids(record),ackBy:record?.ackBy&&typeof record.ackBy==='object'?record.ackBy:{},seenBy:record?.seenBy&&typeof record.seenBy==='object'?record.seenBy:{}}}
  return Object.freeze({status,isOpen,recipientUids,acknowledged,viewed,pending,progress,notification,normalize});
});
