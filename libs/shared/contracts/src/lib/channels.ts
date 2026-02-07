export const IPC_CHANNELS = {
  handshake: 'contract:handshake',
  appGetVersion: 'app:get-version',
  dialogOpenFile: 'dialog:open-file',
  fsReadTextFile: 'fs:read-text-file',
  apiInvoke: 'api:invoke',
  updatesCheck: 'updates:check',
  telemetryTrack: 'telemetry:track',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
