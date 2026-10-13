import { Component } from 'react';
import { useLocation } from 'react-router';
import { usePreferences } from '../../context/PreferencesContext';
class Boundary extends Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){if(!this.state.failed)return this.props.children;
    const ar=this.props.language==='ar';
    return <main className="section container empty-state" role="alert"><h1>{ar?'تعذّر عرض الصفحة':'Unable to display this page'}</h1><p>{ar?'حدث خطأ أثناء تحميل الصفحة. حاول إعادة تحميلها أو العودة للرئيسية.':'Something went wrong loading this page. Reload it or return home.'}</p><div className="account-actions"><button className="button" onClick={()=>window.location.reload()}>{ar?'إعادة المحاولة':'Try again'}</button><a className="button button-outline" href="/">{ar?'الصفحة الرئيسية':'Home'}</a></div></main>;
  }
}
export default function PageErrorBoundary({children}){const {language}=usePreferences(),location=useLocation();return <Boundary key={location.pathname} language={language}>{children}</Boundary>;}
