import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { asSuccess, type DesktopResult } from '@electron-foundation/contracts';

const demoRootFolder = 'update-demo';
const baselineVersion = '1.0.0-demo';
const latestVersion = '1.0.1-demo';
const baselineContent = `demo_version=${baselineVersion}
feature_flag=legacy
message=Baseline demo payload loaded on startup.
`;
const latestContent = `demo_version=${latestVersion}
feature_flag=patched
message=Patched demo payload from bundled versioned feed.
`;
const latestArtifactFile = `feature-${latestVersion}.txt`;

type DemoFeed = {
  version: string;
  artifactFile: string;
  sha256: string;
};

export type DemoUpdateStatus = {
  status: 'available' | 'not-available' | 'error';
  source: 'demo';
  message?: string;
  currentVersion: string;
  latestVersion: string;
  demoFilePath: string;
};

const sha256 = (input: string): string =>
  createHash('sha256').update(input, 'utf8').digest('hex');

export class DemoUpdater {
  private readonly rootPath: string;
  private readonly feedPath: string;
  private readonly artifactPath: string;
  private readonly latestPath: string;
  private readonly runtimePath: string;
  private readonly runtimeVersionPath: string;

  constructor(userDataPath: string) {
    this.rootPath = path.join(userDataPath, demoRootFolder);
    this.feedPath = path.join(this.rootPath, 'feed');
    this.artifactPath = path.join(this.feedPath, latestArtifactFile);
    this.latestPath = path.join(this.feedPath, 'latest.json');
    this.runtimePath = path.join(this.rootPath, 'runtime-demo-feature.txt');
    this.runtimeVersionPath = path.join(this.rootPath, 'runtime-version.txt');
  }

  seedRuntimeWithBaseline(): void {
    mkdirSync(this.rootPath, { recursive: true });
    mkdirSync(this.feedPath, { recursive: true });

    const feed: DemoFeed = {
      version: latestVersion,
      artifactFile: latestArtifactFile,
      sha256: sha256(latestContent),
    };

    writeFileSync(this.artifactPath, latestContent, 'utf8');
    writeFileSync(this.latestPath, JSON.stringify(feed, null, 2), 'utf8');

    // Deterministic demo state: always begin from baseline on launch.
    writeFileSync(this.runtimePath, baselineContent, 'utf8');
    writeFileSync(this.runtimeVersionPath, baselineVersion, 'utf8');
  }

  check(): DesktopResult<DemoUpdateStatus> {
    try {
      const currentVersion = this.getCurrentVersion();
      const feed = this.getFeed();
      const status: DemoUpdateStatus = {
        status: currentVersion === feed.version ? 'not-available' : 'available',
        source: 'demo',
        currentVersion,
        latestVersion: feed.version,
        demoFilePath: this.runtimePath,
      };
      if (status.status === 'available') {
        status.message = `Demo patch available: ${feed.version}`;
      } else {
        status.message = 'Demo file is already at latest bundled version.';
      }
      return asSuccess(status);
    } catch (error) {
      return asSuccess({
        status: 'error',
        source: 'demo',
        message:
          error instanceof Error
            ? error.message
            : 'Demo update check failed unexpectedly.',
        currentVersion: this.safeCurrentVersion(),
        latestVersion,
        demoFilePath: this.runtimePath,
      });
    }
  }

  applyPatch(): DesktopResult<
    DemoUpdateStatus & {
      applied: boolean;
    }
  > {
    const checkResult = this.check();
    if (!checkResult.ok) {
      return asSuccess({
        applied: false,
        status: 'error',
        source: 'demo',
        message: 'Demo update check failed unexpectedly.',
        currentVersion: this.safeCurrentVersion(),
        latestVersion,
        demoFilePath: this.runtimePath,
      });
    }

    const checkData = checkResult.data;
    if (checkData.status !== 'available') {
      return asSuccess({
        ...checkData,
        applied: false,
      });
    }

    try {
      const feed = this.getFeed();
      const artifact = readFileSync(
        path.join(this.feedPath, feed.artifactFile),
        'utf8',
      );
      const digest = sha256(artifact);
      if (digest !== feed.sha256) {
        return asSuccess({
          ...checkData,
          applied: false,
          status: 'error',
          message:
            'Demo patch integrity check failed (sha256 mismatch against bundled feed).',
        });
      }

      writeFileSync(this.runtimePath, artifact, 'utf8');
      writeFileSync(this.runtimeVersionPath, feed.version, 'utf8');
      return asSuccess({
        status: 'not-available',
        source: 'demo',
        message: `Demo patch applied to ${this.runtimePath}`,
        currentVersion: feed.version,
        latestVersion: feed.version,
        demoFilePath: this.runtimePath,
        applied: true,
      });
    } catch (error) {
      return asSuccess({
        ...checkData,
        status: 'error',
        applied: false,
        message:
          error instanceof Error
            ? error.message
            : 'Demo patch apply failed unexpectedly.',
      });
    }
  }

  private getCurrentVersion(): string {
    return readFileSync(this.runtimeVersionPath, 'utf8').trim();
  }

  private safeCurrentVersion(): string {
    try {
      return this.getCurrentVersion();
    } catch {
      return baselineVersion;
    }
  }

  private getFeed(): DemoFeed {
    const payload = JSON.parse(
      readFileSync(this.latestPath, 'utf8'),
    ) as DemoFeed;
    if (!payload.version || !payload.artifactFile || !payload.sha256) {
      throw new Error('Demo feed is missing required fields.');
    }
    return payload;
  }
}
