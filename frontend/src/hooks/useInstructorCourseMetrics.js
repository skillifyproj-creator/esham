import { useEffect,useState } from 'react';
import { useAccountSession } from '../context/AccountSessionContext';
import { financialRequest,bindAccount } from '../services/financialApi';
export default function useInstructorCourseMetrics(){
 const session=useAccountSession(),id=session.status==='authenticated'?session.session.profile.id:null,[state,setState]=useState({});
 useEffect(()=>{const c=new AbortController();setState({id,loading:true});if(id)(async()=>{const items=[];let page=1,total;do{const data=bindAccount(await financialRequest(`/api/instructor/course-metrics?page=${page++}&pageSize=100`,{signal:c.signal}),id);if(!Array.isArray(data.items)||!Number.isInteger(data.totalCount)||!data.items.length&&items.length<data.totalCount)throw Error('response');items.push(...data.items);total=data.totalCount;}while(items.length<total);if(!c.signal.aborted)setState({id,items,loading:false});})().catch(()=>{if(!c.signal.aborted)setState({id,error:true,loading:false});});return()=>c.abort();},[id]);
 return state.id===id?state:{items:[],loading:true};
}
