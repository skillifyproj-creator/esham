import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { usePreferences } from '../../context/PreferencesContext';
import Icon from '../Icon';
import '../../styles/development-admin.css';

export default function DevelopmentAdminAccess() {
  const { language } = usePreferences();
  const { pathname } = useLocation();
  const [open,setOpen] = useState(false), root=useRef(null);
  useEffect(()=>setOpen(false),[pathname]);
  useEffect(()=>{const close=event=>{if(event.key==='Escape'||(event.type==='pointerdown'&&!root.current?.contains(event.target)))setOpen(false);};document.addEventListener('pointerdown',close);document.addEventListener('keydown',close);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',close);};},[]);
  if (!import.meta.env.DEV) return null;
  const label = language === 'ar' ? 'الأدمن · تطوير مؤقت' : 'Admin · Development only';
  return <div className="development-admin-menu" ref={root}>{open&&<nav id="development-admin-pages" aria-label={language==='ar'?'صفحات الأدمن المؤقت':'Development admin pages'}><Link to="/admin">{language==='ar'?'الأدمن العام':'General admin'}</Link><Link to="/category-admin">{language==='ar'?'أدمن التصنيفات':'Category admin'}</Link><small>{language==='ar'?'وصول للتطوير فقط':'Development access only'}</small></nav>}<button type="button" className="development-admin-access" aria-label={label} aria-expanded={open} aria-controls="development-admin-pages" onClick={()=>setOpen(value=>!value)}><Icon name="shield" size={18}/><span>{label}</span></button></div>;
}
