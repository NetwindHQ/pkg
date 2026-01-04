import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubClient } from '../../src/github/api';

// ============================================================================
// Draft Release Filtering Tests
//
// Tests that draft releases (published_at === null) are correctly filtered out
// from the release list. Draft releases are not published and should never
// appear in repository metadata.
// ============================================================================

describe('GitHubClient draft release filtering', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const createMockRelease = (
    id: number,
    options: { prerelease?: boolean; draft?: boolean } = {}
  ) => ({
    id,
    tag_name: `v${id}.0.0`,
    name: `Version ${id}.0.0`,
    body: 'Release notes',
    // Draft releases have null published_at
    published_at: options.draft ? null : '2024-01-01T00:00:00Z',
    prerelease: options.prerelease ?? false,
    assets: [
      {
        name: `package_${id}.0.0_amd64.deb`,
        size: 1000,
        browser_download_url: `https://github.com/owner/repo/releases/download/v${id}.0.0/package.deb`,
      },
    ],
  });

  it('filters out draft releases', async () => {
    const releases = [
      createMockRelease(1),               // Published
      createMockRelease(2, { draft: true }), // Draft
      createMockRelease(3),               // Published
      createMockRelease(4, { draft: true }), // Draft
    ];

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(releases),
    } as Response);

    const client = new GitHubClient();
    const result = await client.getAllReleases('owner', 'repo');

    expect(result).toHaveLength(2);
    expect(result.map(r => r.id)).toEqual([1, 3]);
  });

  it('filters drafts even when including prereleases', async () => {
    const releases = [
      createMockRelease(1),                              // Published
      createMockRelease(2, { prerelease: true }),        // Prerelease (published)
      createMockRelease(3, { draft: true }),             // Draft
      createMockRelease(4, { draft: true, prerelease: true }), // Draft + prerelease
    ];

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(releases),
    } as Response);

    const client = new GitHubClient();
    const result = await client.getAllReleases('owner', 'repo', true); // Include prereleases

    expect(result).toHaveLength(2);
    expect(result.map(r => r.id)).toEqual([1, 2]);
  });

  it('returns empty when all releases are drafts', async () => {
    const releases = [
      createMockRelease(1, { draft: true }),
      createMockRelease(2, { draft: true }),
    ];

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(releases),
    } as Response);

    const client = new GitHubClient();
    const result = await client.getAllReleases('owner', 'repo');

    expect(result).toEqual([]);
  });

  it('handles mixed drafts and prereleases correctly', async () => {
    const releases = [
      createMockRelease(1),                               // Stable, published
      createMockRelease(2, { prerelease: true }),         // Prerelease, published
      createMockRelease(3, { draft: true }),              // Draft (filtered)
    ];

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(releases),
    } as Response);

    const client = new GitHubClient();

    // Without prereleases
    const stableOnly = await client.getAllReleases('owner', 'repo', false);
    expect(stableOnly).toHaveLength(1);
    expect(stableOnly[0].id).toBe(1);

    // With prereleases
    const withPrereleases = await client.getAllReleases('owner', 'repo', true);
    expect(withPrereleases).toHaveLength(2);
    expect(withPrereleases.map(r => r.id)).toEqual([1, 2]);
  });

  it('preserves published_at in returned releases', async () => {
    const publishedAt = '2024-06-15T10:30:00Z';
    const releases = [
      {
        id: 1,
        tag_name: 'v1.0.0',
        name: 'Version 1.0.0',
        body: '',
        published_at: publishedAt,
        prerelease: false,
        assets: [],
      },
    ];

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(releases),
    } as Response);

    const client = new GitHubClient();
    const result = await client.getAllReleases('owner', 'repo');

    expect(result).toHaveLength(1);
    expect(result[0].published_at).toBe(publishedAt);
  });
});
