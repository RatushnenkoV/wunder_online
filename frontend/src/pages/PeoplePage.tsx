import { useAuth } from '../contexts/AuthContext';
import StaffTab from '../components/StaffTab';

export default function PeoplePage() {
  const { user } = useAuth();
  return <StaffTab readOnly={!user?.is_admin} />;
}
