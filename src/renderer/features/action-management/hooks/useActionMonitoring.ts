import { useEffect, useEffectEvent } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectActionMonitoringView } from '@/store/selectors';
import { refreshMonitoredWorkflowsForActiveAccount } from '@/store/slices/actionManagementSlice';

const MONITOR_INTERVAL_MS = 60_000;

export function useActionMonitoring(): void {
  const dispatch = useAppDispatch();
  const activeAccountId = useAppSelector((state) => state.githubAccounts.activeAccountId);
  const { canRequestRefresh, monitoredReferenceSignature, monitoredReferences } = useAppSelector(selectActionMonitoringView);

  const requestRefresh = useEffectEvent(() => {
    if (!activeAccountId || !canRequestRefresh) {
      return;
    }

    void dispatch(refreshMonitoredWorkflowsForActiveAccount());
  });

  useEffect(() => {
    if (!activeAccountId || monitoredReferences.length === 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      requestRefresh();
    }, MONITOR_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeAccountId, monitoredReferenceSignature, monitoredReferences.length, requestRefresh]);

  useEffect(() => {
    if (!activeAccountId || monitoredReferences.length === 0) {
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
  }, [activeAccountId, monitoredReferenceSignature, monitoredReferences.length, requestRefresh]);
}

export default useActionMonitoring;
