import { useEffect, useState } from 'react';
import { usePreferences } from '../../context/PreferencesContext';
export default function StorageNotice() {
  const [error,setError] = useState(false);
  const {language} = usePreferences();
  useEffect(()=>{const show=()=>setError(true); window.addEventListener('esham-storage-error',show); return()=>window.removeEventListener('esham-storage-error',show);},[]);
  return error ? <aside role="alert" style={{position:'fixed',bottom:20,left:20,right:20,zIndex:2000,background:'#fff1ef',color:'#912b27',padding:16,border:'1px solid #e4aaa4',borderRadius:10}}>{language==='ar'?'تعذّر حفظ التعديل. تحقق من مساحة التخزين وأذونات المتصفح ثم أعد المحاولة.':'The change could not be saved. Check storage space and browser permissions, then retry.'} <button onClick={()=>setError(false)}>{language==='ar'?'إغلاق':'Close'}</button></aside> : null;
}
