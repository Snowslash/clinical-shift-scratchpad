import { useCallback, useRef, useState } from 'react';
import { StaleUndoError } from './services/jobStore';
import { StorageMutationError } from './services/storage';

export type ActionState = {
  phase: 'loading' | 'idle' | 'pending' | 'reconciling' | 'failed' | 'reconciled';
  recovery: 'none' | 'reload' | 'review';
  message: string;
};

const idle: ActionState = { phase: 'idle', recovery: 'none', message: '' };
const isBusy = (state: ActionState) => ['loading', 'pending', 'reconciling'].includes(state.phase);

// One UI boundary, not the storage consistency mechanism. Never replay a
// mutation automatically: a rejected promise may have changed durable state.
export function useAsyncAction(reconcile: () => Promise<void>) {
  const [state, setState] = useState<ActionState>({ phase: 'loading', recovery: 'reload', message: 'Loading saved data…' });
  const current = useRef(state);
  const running = useRef(false);
  const loaded = useRef(false);
  const failure = useRef('');
  const publish = useCallback((next: ActionState) => { current.current = next; setState(next); }, []);
  const isBlocked = useCallback(() => running.current || isBusy(current.current) || current.current.recovery !== 'none', []);

  const readBack = useCallback(async () => {
    publish({ phase: loaded.current ? 'reconciling' : 'loading', recovery: 'reload', message: 'Loading saved data…' });
    try {
      await reconcile();
      if (loaded.current) {
        publish({ phase: 'reconciled', recovery: 'review', message: `${failure.current} Saved list reloaded. Check it before trying again; nothing was retried.` });
      } else {
        loaded.current = true;
        publish(idle);
      }
    } catch {
      publish({ phase: 'failed', recovery: 'reload', message: loaded.current
        ? `${failure.current} Could not reload saved data. Changes are blocked; reload before trying again.`
        : 'Could not load saved data. Reload before making changes.' });
    }
  }, [publish, reconcile]);

  const reload = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try { await readBack(); } finally { running.current = false; }
  }, [readBack]);

  const run = useCallback(async (label: string, operation: () => Promise<void>, kind: 'storage' | 'clipboard' = 'storage') => {
    if (isBlocked()) return;
    running.current = true;
    publish({ phase: 'pending', recovery: 'none', message: `${label}…` });
    try {
      await operation();
      publish(idle);
    } catch (error) {
      if (kind === 'clipboard') {
        publish({ phase: 'failed', recovery: 'none', message: 'Clipboard copy not confirmed. You can try again.' });
      } else if (error instanceof StorageMutationError && error.outcome === 'not-committed') {
        publish({ phase: 'failed', recovery: 'none', message: 'Change not saved. Your input and visible list have been kept. You can try again.' });
      } else {
        failure.current = error instanceof StaleUndoError ? error.message
          : 'Storage reported a problem; the change may already be saved.';
        await readBack();
      }
    } finally {
      running.current = false;
    }
  }, [isBlocked, publish, readBack]);

  const acknowledge = useCallback(() => {
    if (current.current.recovery === 'review' && !running.current) {
      publish({ ...current.current, phase: 'failed', recovery: 'none' });
    }
  }, [publish]);

  return { state, run, reload, acknowledge, isBlocked, busy: isBusy(state), blocked: isBusy(state) || state.recovery !== 'none' };
}
