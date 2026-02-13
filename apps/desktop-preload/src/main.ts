import { contextBridge } from 'electron';
import type { DesktopApi } from '@electron-foundation/desktop-api';
import { createAppApi } from './api/app-api';
import { createAuthApi } from './api/auth-api';
import { createDialogApi } from './api/dialog-api';
import { createExternalApi } from './api/external-api';
import { createFsApi } from './api/fs-api';
import { createStorageApi } from './api/storage-api';
import { createTelemetryApi } from './api/telemetry-api';
import { createUpdatesApi } from './api/updates-api';
import { createPythonApi } from './api/python-api';

const desktopApi: DesktopApi = {
  app: createAppApi(),
  auth: createAuthApi(),
  dialog: createDialogApi(),
  fs: createFsApi(),
  storage: createStorageApi(),
  api: createExternalApi(),
  updates: createUpdatesApi(),
  python: createPythonApi(),
  telemetry: createTelemetryApi(),
};

contextBridge.exposeInMainWorld('desktop', desktopApi);
