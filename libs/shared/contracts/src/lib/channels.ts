export const IPC_CHANNELS = {
  handshake: 'contract:handshake',
  appGetVersion: 'app:get-version',
  authSignIn: 'auth:sign-in',
  authSignOut: 'auth:sign-out',
  authGetSessionSummary: 'auth:get-session-summary',
  dialogOpenFile: 'dialog:open-file',
  fsReadTextFile: 'fs:read-text-file',
  storageSetItem: 'storage:set-item',
  storageGetItem: 'storage:get-item',
  storageDeleteItem: 'storage:delete-item',
  storageClearDomain: 'storage:clear-domain',
  apiInvoke: 'api:invoke',
  updatesCheck: 'updates:check',
  telemetryTrack: 'telemetry:track',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
