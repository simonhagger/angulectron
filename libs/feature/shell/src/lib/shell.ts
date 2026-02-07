export interface ShellBadge {
  label: string;
  tone: 'neutral' | 'success' | 'warning';
}

export const createShellBadge = (connected: boolean): ShellBadge => ({
  label: connected ? 'Connected' : 'Disconnected',
  tone: connected ? 'success' : 'warning',
});
