const { MakerZIP } = require('@electron-forge/maker-zip');
const {
  AutoUnpackNativesPlugin,
} = require('@electron-forge/plugin-auto-unpack-natives');

const APP_NAME = 'Angulectron';
const APP_BUNDLE_ID = 'com.simonhagger.angulectron';
const BUILD_ENV = (process.env.APP_ENV ?? 'production').toLowerCase();
const isStagingBuild = BUILD_ENV === 'staging';
const PRODUCT_NAME = isStagingBuild ? `${APP_NAME} Staging` : APP_NAME;
const EXECUTABLE_NAME = isStagingBuild ? `${APP_NAME}-Staging` : APP_NAME;

const hasAppleSigningConfig =
  Boolean(process.env.APPLE_CODESIGN_IDENTITY) &&
  Boolean(process.env.APPLE_TEAM_ID);

/** @type {import('@electron-forge/shared-types').ForgeConfig} */
module.exports = {
  packagerConfig: {
    asar: true,
    derefSymlinks: true,
    icon: './build/icon',
    executableName: EXECUTABLE_NAME,
    appBundleId: APP_BUNDLE_ID,
    appCategoryType: 'public.app-category.developer-tools',
    extraMetadata: {
      appEnv: BUILD_ENV,
    },
    win32metadata: {
      CompanyName: 'Angulectron',
      FileDescription: 'Angulectron Desktop Application',
      ProductName: PRODUCT_NAME,
      InternalName: EXECUTABLE_NAME,
      OriginalFilename: `${EXECUTABLE_NAME}.exe`,
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
  makers: [new MakerZIP({}, ['win32']), new MakerZIP({}, ['darwin'])],
  plugins: [new AutoUnpackNativesPlugin({})],
};
