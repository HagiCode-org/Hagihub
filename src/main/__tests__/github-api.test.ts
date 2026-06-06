import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { commitFile, extractWorkflowDispatchMetadata, fetchFileContent, resolveManagedWorkflowState } from '../github-api.js';

const originalFetch = globalThis.fetch;

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
