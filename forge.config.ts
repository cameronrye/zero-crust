import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { PublisherGithub } from '@electron-forge/publisher-github';
import path from 'node:path';
import 'dotenv/config';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    // App branding
    name: 'Zero Crust',
    executableName: 'zero-crust',
    appBundleId: 'com.zerocrust.app',
    appCopyright: 'Copyright 2026 Zero Crust',
    // App icon - electron-forge will use the appropriate format per platform
    icon: path.resolve(__dirname, 'assets/icon'),
    // Include assets folder in the packaged app (outside ASAR for native access)
    extraResource: [path.resolve(__dirname, 'assets')],
    // macOS specific
    appCategoryType: 'public.app-category.business',

    // ==========================================================================
    // Code Signing Configuration (macOS)
    // ==========================================================================
    // For production builds, set these environment variables:
    // - APPLE_ID: Your Apple ID email
    // - APPLE_APP_SPECIFIC_PASSWORD: App-specific password from appleid.apple.com
    // - APPLE_TEAM_ID: Your Apple Developer Team ID
    //
    // To sign and notarize, run: APPLE_ID=... APPLE_APP_SPECIFIC_PASSWORD=... APPLE_TEAM_ID=... pnpm make
    // ==========================================================================
    ...(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID
      ? {
          osxSign: {},
          osxNotarize: {
            appleId: process.env.APPLE_ID,
            appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
            teamId: process.env.APPLE_TEAM_ID,
          },
        }
      : {}),
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'ZeroCrust',
      authors: 'Zero Crust',
      description: 'Dual-Head Distributed System',
      iconUrl: 'https://raw.githubusercontent.com/example/zero-crust/main/assets/icon.ico',
      setupIcon: path.resolve(__dirname, 'assets/icon.ico'),
      // ==========================================================================
      // Windows Code Signing Configuration
      // ==========================================================================
      // For production builds, set these environment variables:
      // - WINDOWS_CERTIFICATE_FILE: Path to your .pfx certificate file
      // - WINDOWS_CERTIFICATE_PASSWORD: Password for the certificate
      //
      // To sign, run: WINDOWS_CERTIFICATE_FILE=... WINDOWS_CERTIFICATE_PASSWORD=... pnpm make
      // ==========================================================================
      ...(process.env.WINDOWS_CERTIFICATE_FILE && process.env.WINDOWS_CERTIFICATE_PASSWORD
        ? {
            certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
            certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,
          }
        : {}),
    }),
    new MakerZIP({}, ['darwin']),
    new MakerDeb({
      options: {
        name: 'zero-crust',
        productName: 'Zero Crust',
        genericName: 'Business Application',
        description: 'Dual-Head Distributed System',
        categories: ['Office'],
        icon: path.resolve(__dirname, 'assets/icon.png'),
      },
    }),
    new MakerRpm({
      options: {
        name: 'zero-crust',
        productName: 'Zero Crust',
        genericName: 'Business Application',
        description: 'Dual-Head Distributed System',
        categories: ['Office'],
        icon: path.resolve(__dirname, 'assets/icon.png'),
      },
    }),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.mts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    // See: https://electronjs.org/docs/latest/tutorial/fuses
    new FusesPlugin({
      version: FuseVersion.V1,
      // Security: Disable running as Node.js from command line
      [FuseV1Options.RunAsNode]: false,
      // Security: Encrypt cookies at rest
      [FuseV1Options.EnableCookieEncryption]: true,
      // Security: Disable NODE_OPTIONS environment variable
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      // Security: Disable --inspect and --inspect-brk CLI arguments
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      // Security: Validate ASAR archive integrity
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      // Security: Only load app from ASAR (prevent tampering)
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      // Allow file:// protocol to execute scripts (required for production builds)
      // When false, scripts loaded via loadFile() may fail to execute
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,
    }),
  ],
  // ==========================================================================
  // GitHub Releases Publisher Configuration
  // ==========================================================================
  // Publishes builds to GitHub Releases for distribution and auto-updates.
  // Requires GITHUB_TOKEN environment variable with repo scope.
  //
  // To publish: GITHUB_TOKEN=... pnpm publish
  // ==========================================================================
  publishers: [
    new PublisherGithub({
      repository: {
        owner: 'cameronrye',
        name: 'zero-crust',
      },
      prerelease: false,
      draft: true, // Create as draft first, then manually publish after review
      generateReleaseNotes: true,
    }),
  ],
};

export default config;
