import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  commitFile,
  createGitHubRepo,
  extractWorkflowDispatchMetadata,
  fetchFileContent,
  fetchReadmeWorkspace,
  normalizeReadmeVariantContent,
  resolveManagedWorkflowState,
  submitReadmeWorkspace,
} from '../github-api.js';

const originalFetch = globalThis.fetch;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function fileResponse(content: string, sha: string): Response {
  return jsonResponse({
    type: 'file',
    sha,
    encoding: 'base64',
    content: Buffer.from(content, 'utf8').toString('base64'),
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('extractWorkflowDispatchMetadata', () => {
  it('parses workflow_dispatch inputs from workflow yaml', () => {
    const metadata = extractWorkflowDispatchMetadata(`
name: Release
on:
  workflow_dispatch:
    inputs:
      environment:
        description: Deployment target
        required: true
        type: choice
        options:
          - staging
          - production
      dry_run:
        description: Skip publish
        required: false
        type: boolean
        default: false
`);

    assert.equal(metadata.supportsDispatch, true);
    assert.deepEqual(metadata.inputs, [
      {
        name: 'environment',
        description: 'Deployment target',
        required: true,
        defaultValue: null,
        type: 'choice',
        options: ['staging', 'production'],
      },
      {
        name: 'dry_run',
        description: 'Skip publish',
        required: false,
        defaultValue: 'false',
        type: 'boolean',
        options: [],
      },
    ]);
  });

  it('returns unsupported when workflow_dispatch is missing', () => {
    const metadata = extractWorkflowDispatchMetadata(`
name: CI
on:
  push:
    branches:
      - main
`);

    assert.equal(metadata.supportsDispatch, false);
    assert.deepEqual(metadata.inputs, []);
  });
});

describe('createGitHubRepo', () => {
  it('creates a repository for the active personal account', async () => {
    let url = '';
    let body: Record<string, unknown> | null = null;

    globalThis.fetch = async (input, init) => {
      url = String(input);
      body = JSON.parse(String(init?.body));

      return jsonResponse({
        id: 101,
        name: 'starter-repo',
        full_name: 'octocat/starter-repo',
        description: 'Starter repository',
        html_url: 'https://github.com/octocat/starter-repo',
        private: true,
        fork: false,
        updated_at: '2026-06-07T10:00:00.000Z',
        owner: {
          login: 'octocat',
          avatar_url: 'https://avatars.example.com/octocat',
          type: 'User',
        },
      }, 201);
    };

    const result = await createGitHubRepo('token', {
      owner: { type: 'personal', login: 'octocat' },
      name: 'starter-repo',
      description: 'Starter repository',
      visibility: 'private',
      initializeWithReadme: true,
      gitignoreTemplate: 'Node',
      licenseTemplate: 'mit',
    });

    assert.equal(url, 'https://api.github.com/user/repos');
    assert.deepEqual(body, {
      name: 'starter-repo',
      description: 'Starter repository',
      private: true,
      auto_init: true,
      gitignore_template: 'Node',
      license_template: 'mit',
    });
    assert.deepEqual(result, {
      success: true,
      repo: {
        id: 101,
        name: 'starter-repo',
        fullName: 'octocat/starter-repo',
        description: 'Starter repository',
        htmlUrl: 'https://github.com/octocat/starter-repo',
        isPrivate: true,
        isFork: false,
        updatedAt: '2026-06-07T10:00:00.000Z',
        owner: {
          login: 'octocat',
          avatarUrl: 'https://avatars.example.com/octocat',
          type: 'User',
        },
      },
    });
  });

  it('creates a repository for an organization owner', async () => {
    let url = '';
    let body: Record<string, unknown> | null = null;

    globalThis.fetch = async (input, init) => {
      url = String(input);
      body = JSON.parse(String(init?.body));

      return jsonResponse({
        id: 202,
        name: 'org-repo',
        full_name: 'hagicode/org-repo',
        description: null,
        html_url: 'https://github.com/hagicode/org-repo',
        private: false,
        fork: false,
        updated_at: '2026-06-07T11:00:00.000Z',
        owner: {
          login: 'hagicode',
          avatar_url: 'https://avatars.example.com/hagicode',
          type: 'Organization',
        },
      }, 201);
    };

    const result = await createGitHubRepo('token', {
      owner: { type: 'organization', login: 'hagicode' },
      name: 'org-repo',
      description: '   ',
      visibility: 'public',
      initializeWithReadme: false,
      gitignoreTemplate: null,
      licenseTemplate: null,
    });

    assert.equal(url, 'https://api.github.com/orgs/hagicode/repos');
    assert.deepEqual(body, {
      name: 'org-repo',
      private: false,
      auto_init: false,
    });
    assert.equal(result.success, true);
  });

  it('maps duplicate repository failures into a stable renderer payload', async () => {
    globalThis.fetch = async () => jsonResponse({
      message: 'Repository creation failed.',
      errors: [{ message: 'name already exists on this account' }],
    }, 422);

    const result = await createGitHubRepo('token', {
      owner: { type: 'personal', login: 'octocat' },
      name: 'starter-repo',
      visibility: 'public',
      initializeWithReadme: false,
    });

    assert.deepEqual(result, {
      success: false,
      errorCode: 'duplicate',
      errorMessage: 'Repository creation failed. name already exists on this account',
      existingRepoUrl: 'https://github.com/octocat/starter-repo',
    });
  });

  it('preserves repository urls embedded in duplicate responses', async () => {
    globalThis.fetch = async () => jsonResponse({
      message: 'A repository already exists at https://github.com/octocat/starter-repo',
    }, 422);

    const result = await createGitHubRepo('token', {
      owner: { type: 'personal', login: 'octocat' },
      name: 'starter-repo',
      visibility: 'public',
      initializeWithReadme: false,
    });

    assert.deepEqual(result, {
      success: false,
      errorCode: 'duplicate',
      errorMessage: 'A repository already exists at https://github.com/octocat/starter-repo',
      existingRepoUrl: 'https://github.com/octocat/starter-repo',
    });
  });

  it('maps non-duplicate 422 failures into validation errors', async () => {
    globalThis.fetch = async () => jsonResponse({
      message: 'Invalid request.',
      errors: [{ message: 'custom properties are not supported' }],
    }, 422);

    const result = await createGitHubRepo('token', {
      owner: { type: 'personal', login: 'octocat' },
      name: 'starter-repo',
      visibility: 'public',
      initializeWithReadme: false,
    });

    assert.deepEqual(result, {
      success: false,
      errorCode: 'validation',
      errorMessage: 'Invalid request. custom properties are not supported',
    });
  });

  it('maps permission and rate-limit failures into stable renderer payloads', async () => {
    globalThis.fetch = async () => jsonResponse({
      message: 'Resource not accessible by integration',
    }, 403);

    const permissionResult = await createGitHubRepo('token', {
      owner: { type: 'organization', login: 'hagicode' },
      name: 'org-repo',
      visibility: 'private',
      initializeWithReadme: false,
    });

    assert.deepEqual(permissionResult, {
      success: false,
      errorCode: 'permission_denied',
      errorMessage: 'Resource not accessible by integration',
    });

    globalThis.fetch = async () => new Response(JSON.stringify({
      message: 'API rate limit exceeded for user.',
    }), {
      status: 403,
      headers: {
        'content-type': 'application/json',
        'x-ratelimit-remaining': '0',
      },
    });

    const rateLimitResult = await createGitHubRepo('token', {
      owner: { type: 'personal', login: 'octocat' },
      name: 'starter-repo',
      visibility: 'public',
      initializeWithReadme: false,
    });

    assert.deepEqual(rateLimitResult, {
      success: false,
      errorCode: 'rate_limited',
      errorMessage: 'API rate limit exceeded for user.',
    });
  });

  it('maps network failures into a stable renderer payload', async () => {
    globalThis.fetch = async () => {
      throw new Error('socket hang up');
    };

    const result = await createGitHubRepo('token', {
      owner: { type: 'personal', login: 'octocat' },
      name: 'starter-repo',
      visibility: 'public',
      initializeWithReadme: false,
    });

    assert.deepEqual(result, {
      success: false,
      errorCode: 'network',
      errorMessage: 'socket hang up',
    });
  });
});

describe('resolveManagedWorkflowState', () => {
  it('normalizes waiting and running states', () => {
    assert.equal(resolveManagedWorkflowState({
      id: 1,
      workflowName: 'deploy',
      displayTitle: 'Deploy',
      htmlUrl: 'https://example.com',
      status: 'queued',
      conclusion: null,
      event: 'workflow_dispatch',
      branch: 'main',
      runNumber: 2,
      attempt: 1,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }), 'waiting');

    assert.equal(resolveManagedWorkflowState({
      id: 2,
      workflowName: 'deploy',
      displayTitle: 'Deploy',
      htmlUrl: 'https://example.com',
      status: 'in_progress',
      conclusion: null,
      event: 'push',
      branch: 'main',
      runNumber: 3,
      attempt: 1,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }), 'in_progress');
  });

  it('normalizes completed conclusions', () => {
    assert.equal(resolveManagedWorkflowState({
      id: 3,
      workflowName: 'deploy',
      displayTitle: 'Deploy',
      htmlUrl: 'https://example.com',
      status: 'completed',
      conclusion: 'success',
      event: 'workflow_dispatch',
      branch: 'main',
      runNumber: 4,
      attempt: 1,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }), 'success');

    assert.equal(resolveManagedWorkflowState({
      id: 4,
      workflowName: 'deploy',
      displayTitle: 'Deploy',
      htmlUrl: 'https://example.com',
      status: 'completed',
      conclusion: 'failure',
      event: 'workflow_dispatch',
      branch: 'main',
      runNumber: 5,
      attempt: 1,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }), 'failure');

    assert.equal(resolveManagedWorkflowState(null), 'unavailable');
  });
});

describe('fetchFileContent', () => {
  it('decodes file content and preserves sha when the file exists', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({
      type: 'file',
      sha: 'blob-sha',
      encoding: 'base64',
      content: Buffer.from('# hello\n', 'utf8').toString('base64'),
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    });

    const result = await fetchFileContent('token', 'owner', 'repo', 'README.md');

    assert.deepEqual(result, {
      content: '# hello\n',
      sha: 'blob-sha',
      exists: true,
    });
  });

  it('returns an empty result when the file is missing', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Not Found' }), {
      status: 404,
      headers: {
        'content-type': 'application/json',
      },
    });

    const result = await fetchFileContent('token', 'owner', 'repo', 'README.md');

    assert.deepEqual(result, {
      content: '',
      sha: '',
      exists: false,
    });
  });
});

describe('commitFile', () => {
  it('omits sha for file creation and returns the new blob sha', async () => {
    let body: Record<string, unknown> | null = null;

    globalThis.fetch = async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        content: {
          sha: 'new-blob-sha',
        },
      }), {
        status: 201,
        headers: {
          'content-type': 'application/json',
        },
      });
    };

    const result = await commitFile('token', 'owner', 'repo', 'README.md', {
      content: '# title\n',
      message: 'Create README',
      branch: 'main',
      sha: '',
    });

    assert.deepEqual(result, { newSha: 'new-blob-sha' });
    assert.deepEqual(body, {
      message: 'Create README',
      content: Buffer.from('# title\n', 'utf8').toString('base64'),
      branch: 'main',
    });
  });

  it('includes sha for file updates', async () => {
    let body: Record<string, unknown> | null = null;

    globalThis.fetch = async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        content: {
          sha: 'updated-sha',
        },
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    };

    await commitFile('token', 'owner', 'repo', 'README.md', {
      content: '# title\n',
      message: 'Update README',
      branch: 'feature/readme',
      sha: 'current-sha',
    });

    assert.deepEqual(body, {
      message: 'Update README',
      content: Buffer.from('# title\n', 'utf8').toString('base64'),
      branch: 'feature/readme',
      sha: 'current-sha',
    });
  });
});

describe('fetchReadmeWorkspace', () => {
  it('discovers managed root README variants and mirrors the canonical English content', async () => {
    globalThis.fetch = async (input) => {
      const url = String(input);

      if (url.endsWith('/contents')) {
        return jsonResponse([
          { type: 'file', path: 'README.md' },
          { type: 'file', path: 'README_en-us.md' },
          { type: 'file', path: 'README_zh-cn.md' },
          { type: 'file', path: 'docs.md' },
        ]);
      }

      if (url.includes('/contents/README.md')) {
        return fileResponse('# primary\n', 'sha-primary');
      }

      if (url.includes('/contents/README_en-us.md')) {
        return fileResponse('# canonical english\n', 'sha-en');
      }

      if (url.includes('/contents/README_zh-cn.md')) {
        return fileResponse('# 中文\n', 'sha-zh');
      }

      return jsonResponse({ message: 'Not Found' }, 404);
    };

    const result = await fetchReadmeWorkspace('token', 'owner', 'repo');

    assert.deepEqual(result.variants.map((variant) => variant.path), [
      'README.md',
      'README_en-us.md',
      'README_zh-cn.md',
    ]);
    assert.equal(result.variants[0].content, '# canonical english\n');
    assert.equal(result.variants[1].content, '# canonical english\n');
    assert.equal(result.variants[2].content, '# 中文\n');
  });
});

describe('normalizeReadmeVariantContent', () => {
  it('replaces the generated language region instead of duplicating it', () => {
    const content = `<!-- hagihub:readme-languages:start -->\n> Languages: [Old](./README.md)\n<!-- hagihub:readme-languages:end -->\n\n# Title\n`;

    const result = normalizeReadmeVariantContent(content, [
      { path: 'README.md', locale: 'en-us', role: 'primary' },
      { path: 'README_en-us.md', locale: 'en-us', role: 'canonical-en' },
      { path: 'README_zh-cn.md', locale: 'zh-cn', role: 'localized' },
    ]);

    assert.equal(result.match(/hagihub:readme-languages:start/gu)?.length, 1);
    assert.match(result, /README_zh-cn\.md/u);
    assert.match(result, /# Title/u);
  });
});

describe('submitReadmeWorkspace', () => {
  it('writes localized files first and mirrors canonical English content to README.md', async () => {
    const requests: string[] = [];

    globalThis.fetch = async (input, init) => {
      const url = String(input);
      requests.push(`${init?.method ?? 'GET'} ${url}`);

      if (init?.method === 'PUT' && url.includes('/contents/README_zh-cn.md')) {
        return jsonResponse({ content: { sha: 'sha-zh-new' } }, 200);
      }

      if (init?.method === 'PUT' && url.includes('/contents/README_en-us.md')) {
        return jsonResponse({ content: { sha: 'sha-en-new' } }, 200);
      }

      if (init?.method === 'PUT' && url.includes('/contents/README.md')) {
        return jsonResponse({ content: { sha: 'sha-primary-new' } }, 200);
      }

      return jsonResponse({ message: 'Not Found' }, 404);
    };

    const result = await submitReadmeWorkspace('token', 'owner', 'repo', {
      defaultBranch: 'main',
      strategy: 'direct',
      commitMessage: 'Update README variants via Hagihub',
      variants: [
        {
          path: 'README.md',
          locale: 'en-us',
          role: 'primary',
          exists: true,
          sha: 'sha-primary',
          content: '# primary draft\n',
          originalContent: '# primary draft\n',
        },
        {
          path: 'README_en-us.md',
          locale: 'en-us',
          role: 'canonical-en',
          exists: true,
          sha: 'sha-en',
          content: '# canonical english\n',
          originalContent: '# canonical english\n',
        },
        {
          path: 'README_zh-cn.md',
          locale: 'zh-cn',
          role: 'localized',
          exists: true,
          sha: 'sha-zh',
          content: '# 中文\n',
          originalContent: '# 中文\n',
        },
      ],
    });

    assert.equal(result.success, true);
    assert.deepEqual(requests.filter((request) => request.startsWith('PUT')).map((request) => request.split('/contents/')[1]), [
      'README_zh-cn.md',
      'README_en-us.md',
      'README.md',
    ]);

    const primary = result.files.find((file) => file.path === 'README.md');
    const canonical = result.files.find((file) => file.path === 'README_en-us.md');
    assert.equal(primary?.status, 'written');
    assert.equal(canonical?.status, 'written');
    assert.equal(primary?.content, canonical?.content);
    assert.match(primary?.content ?? '', /README_zh-cn\.md/u);
  });

  it('stops a batch save on conflict and reports the failing README variant', async () => {
    const attempted: string[] = [];

    globalThis.fetch = async (input, init) => {
      const url = String(input);

      if (init?.method === 'PUT') {
        attempted.push(url);
      }

      if (init?.method === 'PUT' && url.includes('/contents/README_zh-cn.md')) {
        return jsonResponse({ content: { sha: 'sha-zh-new' } }, 200);
      }

      if (init?.method === 'PUT' && url.includes('/contents/README_en-us.md')) {
        return jsonResponse({ message: 'Conflict' }, 409);
      }

      if (init?.method === 'PUT' && url.includes('/contents/README.md')) {
        return jsonResponse({ content: { sha: 'sha-primary-new' } }, 200);
      }

      return jsonResponse({ message: 'Not Found' }, 404);
    };

    const result = await submitReadmeWorkspace('token', 'owner', 'repo', {
      defaultBranch: 'main',
      strategy: 'direct',
      commitMessage: 'Update README variants via Hagihub',
      variants: [
        {
          path: 'README.md',
          locale: 'en-us',
          role: 'primary',
          exists: true,
          sha: 'sha-primary',
          content: '# primary draft\n',
          originalContent: '# primary draft\n',
        },
        {
          path: 'README_en-us.md',
          locale: 'en-us',
          role: 'canonical-en',
          exists: true,
          sha: 'sha-en',
          content: '# canonical english\n',
          originalContent: '# canonical english\n',
        },
        {
          path: 'README_zh-cn.md',
          locale: 'zh-cn',
          role: 'localized',
          exists: true,
          sha: 'sha-zh',
          content: '# 中文\n',
          originalContent: '# 中文\n',
        },
      ],
    });

    assert.equal(result.success, false);
    assert.equal(result.failedPath, 'README_en-us.md');
    assert.equal(result.files.find((file) => file.path === 'README_zh-cn.md')?.status, 'written');
    assert.equal(result.files.find((file) => file.path === 'README_en-us.md')?.status, 'failed');
    assert.equal(result.files.find((file) => file.path === 'README_en-us.md')?.conflict, true);
    assert.equal(result.files.find((file) => file.path === 'README.md')?.status, 'skipped');
    assert.equal(attempted.length, 2);
  });
});
