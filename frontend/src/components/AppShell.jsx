import { AppNav } from './Nav.jsx';

export default function AppShell({ children }) {
  return (
    <div className="page-fade">
      <AppNav />
      {children}
    </div>
  );
}
