import { useAuth } from '../contexts/AuthContext';
import StaffTab from '../components/StaffTab';

export default function PeoplePage() {
  const { user } = useAuth();
  const isAdmin = user?.is_admin ?? false;

  return <StaffTab readOnly={!isAdmin} />;
}
