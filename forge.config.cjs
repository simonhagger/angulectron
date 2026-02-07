const { MakerSquirrel } = require('@electron-forge/maker-squirrel');
const { MakerZIP } = require('@electron-forge/maker-zip');
const {
  AutoUnpackNativesPlugin,
} = require('@electron-forge/plugin-auto-unpack-natives');

/** @type {import('@electron-forge/shared-types').ForgeConfig} */
module.exports = {
  packagerConfig: {
    asar: true,
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'electron_foundation',
      setupExe: 'ElectronFoundationSetup.exe',
    }),
    new MakerZIP({}, ['darwin']),
  ],
  plugins: [new AutoUnpackNativesPlugin({})],
};
