export type NavLink = {
  path: string;
  label: string;
  icon: string;
  exact?: boolean;
  lab?: boolean;
};

export type AppShellConfig = {
  labsFeatureEnabled: boolean;
  labsToggleLabel: string;
  labsToggleOnLabel: string;
  labsToggleOffLabel: string;
  navLinks: ReadonlyArray<NavLink>;
};

export const APP_SHELL_CONFIG: AppShellConfig = {
  labsFeatureEnabled: false,
  labsToggleLabel: '',
  labsToggleOnLabel: '',
  labsToggleOffLabel: '',
  navLinks: [{ path: '/', label: 'Home', icon: 'home', exact: true }],
};
