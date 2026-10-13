import { Navigate } from 'react-router';
import useAccountProfile from '../../hooks/useAccountProfile';
// UI routing for the demo. Server authorization is required when accounts are connected.
export default function RoleArea({ role, children }) {
 const profile = useAccountProfile();
 if (profile.role && profile.role !== 'both' && profile.role !== role) return <Navigate to={profile.role === 'instructor' ? '/instructor' : '/learner'} replace />;
 return children;
}
