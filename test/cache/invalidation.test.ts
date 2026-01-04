import { describe, it, expect } from 'vitest';
import { computeReleaseIdsHash } from '../../src/cache/cache';
import type { GitHubRelease } from '../../src/types';

// ============================================================================
// Cache Invalidation Tests
// ============================================================================

describe('computeReleaseIdsHash - cache invalidation', () => {
  const createRelease = (
    id: number,
    assets: Array<{ name: string; size: number; digest?: string }>
  ): GitHubRelease => ({
    id,
    tag_name: `v${id}.0.0`,
    name: `Release ${id}`,
    body: '',
    published_at: '2024-01-01T00:00:00Z',
    prerelease: false,
    assets: assets.map((a) => ({
      name: a.name,
      size: a.size,
      browser_download_url: `https://github.com/owner/repo/releases/download/v${id}.0.0/${a.name}`,
      digest: a.digest,
    })),
  });

  it('produces same hash for identical releases', async () => {
    const releases = [
      createRelease(1, [{ name: 'pkg.deb', size: 1000, digest: 'sha256:abc123' }]),
    ];

    const hash1 = await computeReleaseIdsHash(releases);
    const hash2 = await computeReleaseIdsHash(releases);

    expect(hash1).toBe(hash2);
  });

  it('produces different hash when asset digest changes', async () => {
    const releases1 = [
      createRelease(1, [{ name: 'pkg.deb', size: 1000, digest: 'sha256:abc123' }]),
    ];
    const releases2 = [
      createRelease(1, [{ name: 'pkg.deb', size: 1000, digest: 'sha256:def456' }]),
    ];

    const hash1 = await computeReleaseIdsHash(releases1);
    const hash2 = await computeReleaseIdsHash(releases2);

    expect(hash1).not.toBe(hash2);
  });

  it('produces different hash when asset size changes (no digest)', async () => {
    const releases1 = [
      createRelease(1, [{ name: 'pkg.deb', size: 1000 }]),
    ];
    const releases2 = [
      createRelease(1, [{ name: 'pkg.deb', size: 2000 }]),
    ];

    const hash1 = await computeReleaseIdsHash(releases1);
    const hash2 = await computeReleaseIdsHash(releases2);

    expect(hash1).not.toBe(hash2);
  });

  it('produces different hash when new release is added', async () => {
    const releases1 = [
      createRelease(1, [{ name: 'pkg.deb', size: 1000, digest: 'sha256:abc' }]),
    ];
    const releases2 = [
      createRelease(1, [{ name: 'pkg.deb', size: 1000, digest: 'sha256:abc' }]),
      createRelease(2, [{ name: 'pkg2.deb', size: 2000, digest: 'sha256:def' }]),
    ];

    const hash1 = await computeReleaseIdsHash(releases1);
    const hash2 = await computeReleaseIdsHash(releases2);

    expect(hash1).not.toBe(hash2);
  });

  it('produces different hash when asset is added to release', async () => {
    const releases1 = [
      createRelease(1, [{ name: 'pkg.deb', size: 1000, digest: 'sha256:abc' }]),
    ];
    const releases2 = [
      createRelease(1, [
        { name: 'pkg.deb', size: 1000, digest: 'sha256:abc' },
        { name: 'pkg2.deb', size: 2000, digest: 'sha256:def' },
      ]),
    ];

    const hash1 = await computeReleaseIdsHash(releases1);
    const hash2 = await computeReleaseIdsHash(releases2);

    expect(hash1).not.toBe(hash2);
  });

  it('produces different hash when asset is removed from release', async () => {
    const releases1 = [
      createRelease(1, [
        { name: 'pkg.deb', size: 1000, digest: 'sha256:abc' },
        { name: 'pkg2.deb', size: 2000, digest: 'sha256:def' },
      ]),
    ];
    const releases2 = [
      createRelease(1, [{ name: 'pkg.deb', size: 1000, digest: 'sha256:abc' }]),
    ];

    const hash1 = await computeReleaseIdsHash(releases1);
    const hash2 = await computeReleaseIdsHash(releases2);

    expect(hash1).not.toBe(hash2);
  });

  it('produces same hash regardless of release order', async () => {
    const release1 = createRelease(1, [{ name: 'a.deb', size: 1000 }]);
    const release2 = createRelease(2, [{ name: 'b.deb', size: 2000 }]);

    const hash1 = await computeReleaseIdsHash([release1, release2]);
    const hash2 = await computeReleaseIdsHash([release2, release1]);

    expect(hash1).toBe(hash2);
  });

  it('produces same hash regardless of asset order within release', async () => {
    const releases1 = [
      createRelease(1, [
        { name: 'a.deb', size: 1000 },
        { name: 'b.deb', size: 2000 },
      ]),
    ];
    const releases2 = [
      createRelease(1, [
        { name: 'b.deb', size: 2000 },
        { name: 'a.deb', size: 1000 },
      ]),
    ];

    const hash1 = await computeReleaseIdsHash(releases1);
    const hash2 = await computeReleaseIdsHash(releases2);

    expect(hash1).toBe(hash2);
  });

  it('uses digest when available, size when not', async () => {
    const withDigest = [
      createRelease(1, [{ name: 'pkg.deb', size: 1000, digest: 'sha256:abc' }]),
    ];
    const withoutDigest = [
      createRelease(1, [{ name: 'pkg.deb', size: 1000 }]),
    ];

    const hash1 = await computeReleaseIdsHash(withDigest);
    const hash2 = await computeReleaseIdsHash(withoutDigest);

    // Different because one uses digest, other uses size
    expect(hash1).not.toBe(hash2);
  });

  it('handles empty releases array', async () => {
    const hash = await computeReleaseIdsHash([]);
    expect(hash).toBeDefined();
    expect(hash.length).toBe(16);
  });

  it('handles release with no assets', async () => {
    const releases = [createRelease(1, [])];
    const hash = await computeReleaseIdsHash(releases);
    expect(hash).toBeDefined();
    expect(hash.length).toBe(16);
  });

  it('returns 16-character hash', async () => {
    const releases = [
      createRelease(1, [{ name: 'pkg.deb', size: 1000 }]),
    ];

    const hash = await computeReleaseIdsHash(releases);

    expect(hash.length).toBe(16);
  });
});
