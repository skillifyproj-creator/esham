import { useEffect, useRef } from 'react';
import Icon from './Icon';
import '../styles/auth-alert.css';

export default function AuthAlert({ children }) {
  const alert = useRef(null);
  useEffect(() => {
    const bounds = alert.current?.getBoundingClientRect();
    if (bounds && (bounds.top < 0 || bounds.bottom > window.innerHeight)) {
      alert.current.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [children]);
  return <div ref={alert} className="auth-alert" role="alert">
    <Icon name="info" size={18} />
    <p>{children}</p>
  </div>;
}
