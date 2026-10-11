import { NavLink, useLocation } from 'react-router-dom';
import { TABS, tabIndex } from '../lib/tabs.js';
import Icon from './Icon.jsx';

// `--i` is the active tab's position: the one orange pill slides under the labels (see .pill in styles.css).
export default function BottomTabs() {
  const { pathname } = useLocation();
  return (
    <nav className="tabs" aria-label="Main">
      <ul style={{ '--i': tabIndex(pathname) }}>
        <li className="pill" aria-hidden="true" />
        {TABS.map(([to, label, icon]) => (
          <li key={to}>
            <NavLink to={to} viewTransition className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
              <Icon name={icon} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
