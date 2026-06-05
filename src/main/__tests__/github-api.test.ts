import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractWorkflowDispatchMetadata, resolveManagedWorkflowState } from '../github-api.js';

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
