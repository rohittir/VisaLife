import { NavLink } from 'react-router-dom';

const TABS = [
  ['/home', 'Home'],
  ['/journey', 'Journey'],
  ['/policy', 'Policy'],
  ['/me', 'Me'],
];

export default function BottomTabs() {
  return (
    <nav className="tabs" aria-label="Main">
      {TABS.map(([to, label]) => (
        <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
