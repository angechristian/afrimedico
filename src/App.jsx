import AdminPortal from './AdminPortal';
import ClientPortal from './ClientPortal';

function App() {
  const isAdminRoute = window.location.pathname.replace(/\/+$/, '') === '/admin';
  return isAdminRoute ? <AdminPortal /> : <ClientPortal />;
}

export default App;
