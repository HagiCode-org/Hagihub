import { useEffect, useEffectEvent, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { GitHubManagedWorkflow, GitHubManagedWorkflowReference } from '../../../../shared/api';
import { useAppDispatch, useAppSelector } from '@/store';
import { refreshManagedWorkflows } from '@/store/slices/actionManagementSlice';

const MONITOR_INTERVAL_MS = 60_000;

function workflowKey(workflow: Pick<GitHubManagedWorkflowReference, 'repoFullName' | 'workflowId'>): string {
  return `${workflow.repoFullName}#${workflow.workflowId}`;
}

function isRunningState(state: GitHubManagedWorkflow['latestRunState'] | undefined): boolean {
  return state === 'in_progress' || state === 'waiting';
}

function isTerminalState(state: GitHubManagedWorkflow['latestRunState']): state is 'success' | 'failure' {
  return state === 'success' || state === 'failure';
}

export function useActionMonitoring(accountId: string | null): void {
  const { t } = useTranslation('github');
  const dispatch = useAppDispatch();
  const { managedReferences, managedWorkflows, refreshStatus } = useAppSelector((state) => state.actionManagement);
  const previousStatesRef = useRef<Map<string, GitHubManagedWorkflow['latestRunState']>>(new Map());
  const hasBaselineRef = useRef(false);
  const monitoredReferences = managedReferences.filter((workflow) => workflow.monitored === true);
  const monitoredReferenceSignature = monitoredReferences
    .map((workflow) => workflowKey(workflow))
    .sort()
    .join('|');

  const requestRefresh = useEffectEvent(() => {
    if (!accountId || monitoredReferences.length === 0 || refreshStatus === 'loading') {
      return;
    }

    void dispatch(refreshManagedWorkflows({
      accountId,
      workflows: monitoredReferences,
    }));
  });

  const sendCompletionNotification = useEffectEvent(async (workflow: GitHubManagedWorkflow) => {
    const statusKey = workflow.latestRunState === 'success' ? 'success' : 'failure';
    const detailLine = workflow.latestRun?.displayTitle?.trim();
    const body = detailLine
      ? `${workflow.repoFullName} - ${t(`actionManagement.actionMonitoring.state.${statusKey}`)}\n${detailLine}`
      : `${workflow.repoFullName} - ${t(`actionManagement.actionMonitoring.state.${statusKey}`)}`;

    try {
      const result = await window.hagihub.sendNotification({
        title: `${workflow.workflowName} ${t('actionManagement.actionMonitoring.notification.completed')}`,
        body,
        level: workflow.latestRunState === 'success' ? 'success' : 'error',
        clickAction: { type: 'focus-window', section: 'actions' },
      });

      if (!result.success) {
        console.warn('[action-monitoring] Failed to send workflow notification', {
          workflowKey: workflowKey(workflow),
          error: result.error,
        });
      }
    } catch (error) {
      console.warn('[action-monitoring] Failed to send workflow notification', {
        workflowKey: workflowKey(workflow),
        error,
      });
    }
  });

  useEffect(() => {
    if (!accountId) {
      previousStatesRef.current = new Map();
      hasBaselineRef.current = false;
    }
  }, [accountId]);

  useEffect(() => {
    if (!accountId || monitoredReferences.length === 0) {
      previousStatesRef.current = new Map();
      hasBaselineRef.current = false;
      return;
    }

    const intervalId = window.setInterval(() => {
      requestRefresh();
    }, MONITOR_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [accountId, monitoredReferenceSignature, monitoredReferences.length, requestRefresh]);

  useEffect(() => {
    if (!accountId || monitoredReferences.length === 0) {
      return undefined;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [accountId, monitoredReferenceSignature, monitoredReferences.length, requestRefresh]);

  useEffect(() => {
    if (!accountId || monitoredReferences.length === 0) {
      previousStatesRef.current = new Map();
      hasBaselineRef.current = false;
      return;
    }

    const monitoredWorkflowKeys = new Set(monitoredReferences.map((workflow) => workflowKey(workflow)));
    const monitoredWorkflows = managedWorkflows.filter((workflow) => monitoredWorkflowKeys.has(workflowKey(workflow)));
    const nextStates = new Map(monitoredWorkflows.map((workflow) => [workflowKey(workflow), workflow.latestRunState]));

    if (!hasBaselineRef.current) {
      previousStatesRef.current = nextStates;
      hasBaselineRef.current = true;
      return;
    }

    for (const workflow of monitoredWorkflows) {
      const previousState = previousStatesRef.current.get(workflowKey(workflow));

      if (!isRunningState(previousState) || !isTerminalState(workflow.latestRunState)) {
        continue;
      }

      void sendCompletionNotification(workflow);
    }

    previousStatesRef.current = nextStates;
  }, [accountId, managedWorkflows, monitoredReferenceSignature, monitoredReferences, sendCompletionNotification]);
}

export default useActionMonitoring;
