import { useEffect,useRef,useState } from 'react';
import { useAccountSession } from '../../context/AccountSessionContext';
import { replyReview,reviewError } from '../../services/learnerReviewsApi';
export default function ReviewReplyForm({review,language,onSaved}){
 const session=useAccountSession(),account=session.status==='authenticated'?session.session.profile.id:null,current=useRef(account);current.current=account;
 const [reply,setReply]=useState(review.instructorReply||''),[busy,setBusy]=useState(false),[error,setError]=useState(''),pending=useRef(null),ar=language==='ar';
 useEffect(()=>{setReply(review.instructorReply||'');setError('');pending.current=null;},[account,review.id,review.version]);
 async function save(remove=false){if(busy||!account)return;const id=account,key=JSON.stringify([id,review.id,review.version,reply,remove]);if(pending.current?.key!==key)pending.current={key,id:crypto.randomUUID()};setBusy(true);setError('');
  try{await replyReview(id,review.id,{requestId:pending.current.id,expectedVersion:review.version,reply},remove);if(current.current===id){pending.current=null;onSaved();}}catch{if(current.current===id)setError(reviewError(language));}finally{if(current.current===id)setBusy(false);}}
 return <form onSubmit={e=>{e.preventDefault();save();}}><label>{ar?'رد المدرّب':'Instructor reply'}<textarea rows={3} maxLength={2000} required value={reply} onChange={e=>setReply(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<div className="account-actions"><button className="button" disabled={busy}>{ar?'حفظ الرد':'Save reply'}</button>{review.instructorReply&&<button type="button" className="button secondary" disabled={busy} onClick={()=>save(true)}>{ar?'سحب الرد':'Withdraw reply'}</button>}</div></form>;
}
