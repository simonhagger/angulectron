import { APP_NAV_LINKS, type NavLink } from './app-route-registry';
export type { NavLink } from './app-route-registry';

export type AppShellConfig = {
  labsFeatureEnabled: boolean;
  labsToggleLabel: string;
  labsToggleOnLabel: string;
  labsToggleOffLabel: string;
  navLinks: ReadonlyArray<NavLink>;
};

export const APP_SHELL_CONFIG: AppShellConfig = {
  labsFeatureEnabled: true,
  labsToggleLabel: 'Labs Mode:',
  labsToggleOnLabel: 'On',
  labsToggleOffLabel: 'Off',
  navLinks: APP_NAV_LINKS,
};
