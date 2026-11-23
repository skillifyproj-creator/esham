import { useEffect,useRef,useState } from 'react';
import { useAccountSession } from '../context/AccountSessionContext';
import { loadReviews,mutateReview } from '../services/learnerReviewsApi';
export function validReview(review){return Boolean(review&&Number.isInteger(review.rating)&&review.rating>=1&&review.rating<=5&&typeof review.text==='string'&&Array.from(review.text.trim()).length>=25&&review.text.length<=2000);}
export function useLearnerReviews(){
 const session=useAccountSession(),id=session.status==='authenticated'?session.session.profile.id:null;
 const [state,setState]=useState({}),[revision,reload]=useState(0),[page,setPage]=useState(1),identity=useRef(id);identity.current=id;
 const pending=useRef(null);
 useEffect(()=>{const c=new AbortController();setState({accountId:id,loading:true});pending.current=null;
  if(id)loadReviews(id,page,c.signal).then(data=>{if(!c.signal.aborted)setState({...data,loading:false});}).catch(error=>{if(!c.signal.aborted)setState({accountId:id,error,loading:false});});
  return()=>c.abort();
 },[id,page,revision]);
 const visible=state.accountId===id?state:{};
 async function save(enrollment,rating,text,existing,withdraw=false){
  const expected=existing?.version??null,key=JSON.stringify([id,enrollment.id,expected,rating,text,withdraw]);
  if(!pending.current||pending.current.key!==key)pending.current={key,requestId:crypto.randomUUID()};
  const account=id;await mutateReview(account,enrollment.id,{requestId:pending.current.requestId,expectedVersion:expected,expectedCourseVersionId:enrollment.courseVersionId,rating,comment:text}, {withdraw});
  if(identity.current!==account)throw new Error('account_changed');pending.current=null;reload(x=>x+1);
 }
 return{reviews:visible.items||[],loading:Boolean(id)&&visible.loading!==false,error:visible.error,page,totalCount:visible.totalCount||0,setPage,
  saveReview:(enrollment,rating,text,existing)=>save(enrollment,rating,text,existing),deleteReview:(enrollment,existing)=>save(enrollment,0,'',existing,true)};
}
