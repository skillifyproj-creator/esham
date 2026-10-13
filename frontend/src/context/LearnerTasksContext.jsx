import { createContext, useContext, useEffect, useState } from 'react';
import { useLearner } from './LearnerContext';
import useAccountProfile from '../hooks/useAccountProfile';
import { accountId } from '../data/pointsLedger';
import { courseTasks, readTaskSubmissions, saveTaskSubmission, TASK_EVENT } from '../services/taskSubmissions';
const Context=createContext(null);
export function LearnerTasksProvider({children}) {
 const {enrollments}=useLearner(); const profile=useAccountProfile(); const [,refresh]=useState(0);
 useEffect(()=>{const update=()=>refresh(value=>value+1);window.addEventListener(TASK_EVENT,update);window.addEventListener('storage',update);return()=>{window.removeEventListener(TASK_EVENT,update);window.removeEventListener('storage',update);};},[]);
 let legacy={};try{if(!profile.id)legacy=JSON.parse(localStorage.getItem('esham-task-submissions-v1')||'{}');}catch{}
 const records=readTaskSubmissions().filter(item=>item.learnerId===accountId(profile));
 const tasks=courseTasks().filter(task=>enrollments.some(item=>item.courseId===task.courseId)).map(task=>({...task,...legacy[task.id],...records.find(item=>item.taskId===task.id),id:task.id,submissionId:records.find(item=>item.taskId===task.id)?.id}));
 function saveTask(id,answer,link,submit=false,files=[]) {try{saveTaskSubmission(profile,id,{answer,link,submit,files});refresh(value=>value+1);return true;}catch{return false;}}
 return <Context.Provider value={{tasks,saveTask}}>{children}</Context.Provider>;
}
export function useLearnerTasks(){const value=useContext(Context);if(!value)throw new Error('useLearnerTasks requires LearnerTasksProvider');return value;}
