// The four tabs, in bar order: [path, label, icon]. Kept apart from the component so tests can import it under node.
export const TABS = [
  ['/home', 'Today', 'home'],
  ['/journey', 'Journey', 'route'],
  ['/policy', 'Policy', 'gavel'],
  ['/me', 'Me', 'user'],
];

// Position of the current page in the bar, which places the sliding pill. Unknown paths fall back to the first tab.
export const tabIndex = (pathname) => Math.max(0, TABS.findIndex(([to]) => pathname === to || pathname.startsWith(`${to}/`)));
