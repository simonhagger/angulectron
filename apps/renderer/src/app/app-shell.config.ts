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
  navLinks: NavLink[];
};

export const APP_SHELL_CONFIG: AppShellConfig = {
  labsFeatureEnabled: true,
  labsToggleLabel: 'Labs Mode:',
  labsToggleOnLabel: 'On',
  labsToggleOffLabel: 'Off',
  navLinks: [
    { path: '/', label: 'Home', icon: 'home', exact: true },
    {
      path: '/material-showcase',
      label: 'Material Showcase',
      icon: 'palette',
      lab: true,
    },
    {
      path: '/material-carbon-lab',
      label: 'Material Carbon Lab',
      icon: 'tune',
      lab: true,
    },
    {
      path: '/carbon-showcase',
      label: 'Carbon Showcase',
      icon: 'view_quilt',
      lab: true,
    },
    {
      path: '/tailwind-showcase',
      label: 'Tailwind Showcase',
      icon: 'waterfall_chart',
      lab: true,
    },
    {
      path: '/form-validation-lab',
      label: 'Form Validation Lab',
      icon: 'fact_check',
      lab: true,
    },
    {
      path: '/async-validation-lab',
      label: 'Async Validation Lab',
      icon: 'pending_actions',
      lab: true,
    },
    {
      path: '/data-table-workbench',
      label: 'Data Table Workbench',
      icon: 'table_chart',
      lab: true,
    },
    {
      path: '/theme-tokens-playground',
      label: 'Theme Tokens Playground',
      icon: 'format_paint',
      lab: true,
    },
    {
      path: '/offline-retry-simulator',
      label: 'Offline Retry Simulator',
      icon: 'wifi_off',
      lab: true,
    },
    {
      path: '/file-workflow-studio',
      label: 'File Workflow Studio',
      icon: 'schema',
      lab: true,
    },
    {
      path: '/storage-explorer',
      label: 'Storage Explorer',
      icon: 'storage',
      lab: true,
    },
    {
      path: '/api-playground',
      label: 'API Playground',
      icon: 'api',
      lab: true,
    },
    {
      path: '/updates-release',
      label: 'Updates & Release',
      icon: 'system_update',
      lab: true,
    },
    {
      path: '/telemetry-console',
      label: 'Telemetry Console',
      icon: 'analytics',
      lab: true,
    },
    {
      path: '/ipc-diagnostics',
      label: 'IPC Diagnostics',
      icon: 'cable',
      lab: true,
    },
    {
      path: '/auth-session-lab',
      label: 'Auth Session Lab',
      icon: 'badge',
      lab: true,
    },
    {
      path: '/file-tools',
      label: 'File Tools',
      icon: 'folder_open',
      lab: true,
    },
  ],
};
