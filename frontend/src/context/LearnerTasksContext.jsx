import { createContext,useContext,useEffect,useState } from 'react';
import { useAccountSession } from './AccountSessionContext';
import { useLearner } from './LearnerContext';
import { taskList } from '../services/learnerSubmissionsApi';
const Context=createContext({tasks:[],errors:{},loading:false,refresh:()=>{}});
export function LearnerTasksProvider({children}) {
  const account=useAccountSession(),data=useLearner(),id=account.status==='authenticated'?account.session.profile.id:null;
  const key=data.enrollments.map(e=>e.id).join(','),[state,setState]=useState(null),[revision,refresh]=useState(0);
  useEffect(()=>{const controller=new AbortController();let active=true;setState(null);
    async function load(){const tasks=[],errors={};const ids=key.split(',').filter(Boolean);
      for(let n=0;n<ids.length;n+=4)await Promise.all(ids.slice(n,n+4).map(async enrollmentId=>{try{const page=await taskList(id,enrollmentId,controller.signal);tasks.push(...page.items.map(t=>({...t,enrollmentId,mutationsEnabled:page.mutationsEnabled})));}catch(e){errors[enrollmentId]=e;}}));
      if(active)setState({id,tasks,errors});}
    if(id)load();return()=>{active=false;controller.abort();};
  },[id,key,revision]);
  useEffect(()=>{const update=()=>refresh(n=>n+1);window.addEventListener('esham-tasks-updated',update);window.addEventListener('focus',update);return()=>{window.removeEventListener('esham-tasks-updated',update);window.removeEventListener('focus',update);};},[]);
  return <Context.Provider value={{tasks:state?.id===id?state.tasks:[],errors:state?.id===id?state.errors:{},loading:!!id&&!state,refresh:()=>refresh(n=>n+1)}}>{children}</Context.Provider>;
}
export const useLearnerTasks=()=>useContext(Context);
