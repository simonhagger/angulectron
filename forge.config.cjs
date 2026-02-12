const { MakerSquirrel } = require('@electron-forge/maker-squirrel');
const { MakerZIP } = require('@electron-forge/maker-zip');
const {
  AutoUnpackNativesPlugin,
} = require('@electron-forge/plugin-auto-unpack-natives');

const APP_NAME = 'Angulectron';
const APP_SLUG = 'angulectron';
const APP_BUNDLE_ID = 'com.simonhagger.angulectron';

const hasAppleSigningConfig =
  Boolean(process.env.APPLE_CODESIGN_IDENTITY) &&
  Boolean(process.env.APPLE_TEAM_ID);

/** @type {import('@electron-forge/shared-types').ForgeConfig} */
module.exports = {
  packagerConfig: {
    asar: true,
    derefSymlinks: true,
    executableName: APP_NAME,
    appBundleId: APP_BUNDLE_ID,
    appCategoryType: 'public.app-category.developer-tools',
    win32metadata: {
      CompanyName: 'Angulectron',
      FileDescription: 'Angulectron Desktop Application',
      ProductName: APP_NAME,
      InternalName: APP_NAME,
      OriginalFilename: `${APP_NAME}.exe`,
    },
    osxSign: hasAppleSigningConfig
      ? {
          identity: process.env.APPLE_CODESIGN_IDENTITY,
          hardenedRuntime: true,
          entitlements: 'build/entitlements.mac.plist',
          'entitlements-inherit': 'build/entitlements.mac.plist',
          signatureFlags: 'library',
          teamId: process.env.APPLE_TEAM_ID,
        }
      : undefined,
    osxNotarize: hasAppleSigningConfig
      ? {
          appleId: process.env.APPLE_ID,
          appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
          teamId: process.env.APPLE_TEAM_ID,
        }
      : undefined,
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: APP_SLUG,
      setupExe: `${APP_NAME}Setup.exe`,
    }),
    new MakerZIP({}, ['darwin']),
  ],
  plugins: [new AutoUnpackNativesPlugin({})],
};
