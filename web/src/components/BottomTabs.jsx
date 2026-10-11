import { NavLink } from 'react-router-dom';
import Icon from './Icon.jsx';

const TABS = [
  ['/home', 'Today', 'home'],
  ['/journey', 'Journey', 'route'],
  ['/policy', 'Policy', 'gavel'],
  ['/me', 'Me', 'user'],
];

export default function BottomTabs() {
  return (
    <nav className="tabs" aria-label="Main">
      <ul>
        {TABS.map(([to, label, icon]) => (
          <li key={to}>
            <NavLink to={to} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
              <Icon name={icon} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
