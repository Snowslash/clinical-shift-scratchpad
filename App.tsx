import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  Alert,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppearanceMode, AppSettings, ClinicalJob, DEFAULT_APPEARANCE_MODE, DEFAULT_AUTO_DELETE_HOURS, DEFAULT_COMPACT_MODE, DEFAULT_LOCATION_SHORTCUTS, DEFAULT_NOTE_SHORTCUTS, DEFAULT_STATUS_PHRASE_SHORTCUTS, JobFilter, JobStatus, SortPreset } from './src/types/job';
import { jobStore } from './src/services/jobStore';
import { filterJobs, groupJobsByLocation, sortJobs } from './src/utils/jobSorting';
import { buildHandoverText } from './src/utils/handover';
import { JobsScreen, HandoverScreen, SettingsScreen, JobFormModal, UndoBar, JobFormState, ActionNotice } from './src/components';
import { useAsyncAction } from './src/useAsyncAction';
import { darkTheme, lightTheme, stylesForTheme } from './src/theme';

type Screen = 'jobs' | 'review' | 'settings';
type UndoState = {
  id: string;
  message: string;
  jobs: ClinicalJob[];
};

const emptyForm: JobFormState = {
  taskText: '',
  patientIdentifier: '',
  location: '',
  urgency: 'soon',
  jobType: undefined,
  waitingFor: '',
};

const nextStatus: Record<JobStatus, JobStatus> = {
  pending: 'seen',
  seen: 'waiting',
  waiting: 'done',
  done: 'pending',
};

const parseShortcutText = (value: string) => value
  .split(/[\n,]/)
  .map((item) => item.trim())
  .filter(Boolean);

const settingsAppearanceIsDark = (systemScheme: ReturnType<typeof useColorScheme>, appearanceMode: AppearanceMode) => {
  if (appearanceMode === 'dark') return true;
  if (appearanceMode === 'light') return false;
  return systemScheme !== 'light';
};

export default function App() {
  const colorScheme = useColorScheme();
  const [screen, setScreen] = useState<Screen>('jobs');
  const [jobs, setStoredJobs] = useState<ClinicalJob[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ autoDeleteHours: DEFAULT_AUTO_DELETE_HOURS, locationShortcuts: DEFAULT_LOCATION_SHORTCUTS, noteShortcuts: DEFAULT_NOTE_SHORTCUTS, compactMode: DEFAULT_COMPACT_MODE, appearanceMode: DEFAULT_APPEARANCE_MODE, statusPhraseShortcuts: DEFAULT_STATUS_PHRASE_SHORTCUTS, hapticsEnabled: true });
  const dark = settingsAppearanceIsDark(colorScheme, settings.appearanceMode);
  const theme = dark ? darkTheme : lightTheme;
  const styles = stylesForTheme(theme);
  const [filter, setFilter] = useState<JobFilter>('all');
  const [form, setForm] = useState<JobFormState>(emptyForm);
  const [formVisible, setFormVisible] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoState[]>([]);
  const [sortPreset, setSortPreset] = useState<SortPreset>('pinnedFirst');
  const [groupByLocationEnabled, setGroupByLocationEnabled] = useState(false);

  const reconcile = useCallback(async () => {
    const [storedJobs, storedSettings] = await Promise.all([jobStore.getJobs(), jobStore.getSettings()]);
    setStoredJobs(storedJobs);
    setSettings(storedSettings);
    setUndoStack([]);
  }, []);
  const actions = useAsyncAction(reconcile);
  const { reload } = actions;
  const setJobs = (next: ClinicalJob[]) => {
    setStoredJobs(next);
    setUndoStack([]);
  };

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (undoStack.length === 0) return undefined;
    const timer = setTimeout(() => setUndoStack((stack) => stack.slice(1)), 10000);
    return () => clearTimeout(timer);
  }, [undoStack]);

  const pulse = async (kind: 'light' | 'success' | 'warning' = 'light') => {
    if (!settings.hapticsEnabled) return;
    try {
      if (kind === 'success') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else if (kind === 'warning') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      else await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics are best-effort only.
    }
  };

  const showUndo = (message: string, undoJobs: ClinicalJob[]) => {
    if (undoJobs.length === 0) return;
    setUndoStack([{ id: `${Date.now()}-${message}`, message, jobs: undoJobs }]);
  };

  const undoLastChange = () => actions.run('Undoing change', async () => {
    const undo = undoStack.at(-1);
    if (!undo) return;
    const restored = await jobStore.restoreJobs(undo.jobs);
    setJobs(restored);
    setUndoStack((stack) => stack.slice(0, -1));
    pulse('warning');
  });

  const visibleJobs = useMemo(() => sortJobs(filterJobs(jobs, filter), sortPreset), [jobs, filter, sortPreset]);
  const handoverText = useMemo(() => buildHandoverText(jobs), [jobs]);
  const visibleGroups = useMemo(() => groupByLocationEnabled ? groupJobsByLocation(visibleJobs) : [], [groupByLocationEnabled, visibleJobs]);
  const shiftStats = useMemo(() => ({ active: jobs.filter((job) => job.status !== 'done').length, completed: jobs.filter((job) => job.status === 'done').length, total: jobs.length }), [jobs]);

  const getRecentLocation = () => sortJobs(jobs).find((job) => job.location)?.location ?? '';

  const openAdd = (useRecentLocation = false) => {
    if (actions.isBlocked()) return;
    setForm({ ...emptyForm, location: useRecentLocation ? getRecentLocation() : '' });
    setFormVisible(true);
  };

  const openEdit = (job: ClinicalJob) => {
    if (actions.isBlocked()) return;
    setForm({
      id: job.id,
      taskText: job.taskText,
      patientIdentifier: job.patientIdentifier ?? '',
      location: job.location ?? '',
      urgency: job.urgency,
      jobType: job.jobType,
      waitingFor: job.waitingFor ?? '',
    });
    setFormVisible(true);
  };

  const saveForm = (keepOpen = false) => actions.run('Saving', async () => {
    const taskText = form.taskText.trim();
    if (!taskText) {
      Alert.alert('Task needed', 'Free text is the only required field.');
      return;
    }

    if (form.id) {
      const next = await jobStore.updateJob(form.id, {
        taskText,
        patientIdentifier: form.patientIdentifier.trim() || undefined,
        location: form.location.trim() || undefined,
        urgency: form.urgency,
        jobType: form.jobType,
        waitingFor: form.waitingFor.trim() || undefined,
      });
      setJobs(next);
    } else {
      const next = await jobStore.addJob({
        taskText,
        patientIdentifier: form.patientIdentifier,
        location: form.location,
        urgency: form.urgency,
        jobType: form.jobType,
        waitingFor: form.waitingFor.trim() || undefined,
      });
      setJobs(next);
      if (keepOpen) {
        setForm({ ...emptyForm, location: form.location, urgency: form.urgency, jobType: form.jobType });
        pulse('success');
        return;
      }
    }
    setFormVisible(false);
    setForm(emptyForm);
  });

  const setJobStatus = (id: string, status: JobStatus) => actions.run('Updating status', async () => {
    if (status === 'done') {
      const change = await jobStore.setStatusWithUndo(id, status);
      setJobs(change.jobs);
      showUndo('Marked done', change.undoJobs);
      return;
    }
    setJobs(await jobStore.setStatus(id, status));
    pulse('light');
  });

  const togglePinned = (id: string) => actions.run('Updating pin', async () => {
    setJobs(await jobStore.togglePinned(id));
    pulse('light');
  });

  const bumpJob = (id: string) => actions.run('Bumping job', async () => {
    setJobs(await jobStore.bumpJob(id));
    pulse('light');
  });

  const duplicateJob = (id: string) => actions.run('Duplicating job', async () => {
    setJobs(await jobStore.duplicateJob(id));
    pulse('success');
  });

  const chaseJob = (id: string) => actions.run('Updating chase', async () => {
    setJobs(await jobStore.chaseJob(id));
    pulse('light');
  });

  const startShift = () => actions.run('Starting shift', async () => {
    setSettings(await jobStore.startShift());
    pulse('success');
  });

  const endShift = async () => {
    if (actions.isBlocked()) return;
    Alert.alert('End local shift?', 'This only clears the shift timer. Jobs stay on this device unless you clear or wipe them.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End shift', onPress: () => actions.run('Ending shift', async () => { setSettings(await jobStore.endShift()); pulse('warning'); }) },
    ]);
  };

  const saveCompactMode = (compactMode: boolean) => actions.run('Saving settings', async () => {
    const next = await jobStore.saveSettings({ ...settings, compactMode });
    setSettings(next);
  });

  const saveAppearanceMode = (appearanceMode: AppearanceMode) => actions.run('Saving settings', async () => {
    const next = await jobStore.saveSettings({ ...settings, appearanceMode });
    setSettings(next);
  });

  const saveHapticsEnabled = (hapticsEnabled: boolean) => actions.run('Saving settings', async () => {
    const next = await jobStore.saveSettings({ ...settings, hapticsEnabled });
    setSettings(next);
  });

  const saveStatusPhraseShortcuts = (value: string) => actions.run('Saving settings', async () => {
    const next = await jobStore.saveSettings({ ...settings, statusPhraseShortcuts: parseShortcutText(value) });
    setSettings(next);
  });

  const deleteJob = (job: ClinicalJob) => {
    if (actions.isBlocked()) return;
    Alert.alert('Delete job?', 'This removes the job from this device. You can undo briefly.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => actions.run('Deleting job', async () => {
          const change = await jobStore.deleteJobWithUndo(job.id);
          setJobs(change.jobs);
          showUndo('Deleted job', change.undoJobs);
        }),
      },
    ]);
  };

  const clearCompleted = () => {
    if (actions.isBlocked()) return;
    Alert.alert('Clear completed jobs?', 'All jobs marked done will be deleted. You can undo briefly.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear done',
        style: 'destructive',
        onPress: () => actions.run('Clearing completed jobs', async () => {
          const change = await jobStore.clearCompletedWithUndo();
          setJobs(change.jobs);
          showUndo('Cleared completed jobs', change.undoJobs);
        }),
      },
    ]);
  };

  const wipeAll = () => {
    if (actions.isBlocked()) return;
    Alert.alert('Wipe all local data?', 'This deletes every scratchpad job on this device. You can undo briefly until the undo bar disappears.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Wipe all',
        style: 'destructive',
        onPress: () => actions.run('Wiping jobs', async () => {
          const change = await jobStore.wipeAllWithUndo();
          setJobs(change.jobs);
          showUndo('Wiped all jobs', change.undoJobs);
        }),
      },
    ]);
  };

  const saveAutoDeleteHours = (value: string) => actions.run('Saving settings', async () => {
    const parsed = Number(value.replace(/[^0-9.]/g, ''));
    const next = await jobStore.saveSettings({ ...settings, autoDeleteHours: parsed });
    setSettings(next);
  });

  const saveLocationShortcuts = (value: string) => actions.run('Saving settings', async () => {
    const next = await jobStore.saveSettings({ ...settings, locationShortcuts: parseShortcutText(value) });
    setSettings(next);
  });

  const saveNoteShortcuts = (value: string) => actions.run('Saving settings', async () => {
    const next = await jobStore.saveSettings({ ...settings, noteShortcuts: parseShortcutText(value) });
    setSettings(next);
  });

  const copyHandover = () => {
    if (actions.isBlocked()) return;
    Alert.alert(
      'Check identifiers before copying',
      'The clipboard may be visible to other apps or device services. Do not copy excessive patient-identifiable information.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy locally',
          onPress: () => actions.run('Copying', async () => {
            const copied = await Clipboard.setStringAsync(handoverText);
            if (!copied) throw new Error('Clipboard copy not confirmed');
            Alert.alert('Copied', 'Handover text copied to the local clipboard.');
          }, 'clipboard'),
        },
      ],
    );
  };

  return (
    <GestureHandlerRootView style={styles.root}>
    <SafeAreaProvider>
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}> 
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View style={[styles.header, { borderBottomColor: theme.border }]}> 
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Shift scratchpad</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>Local-only temporary jobs list</Text>
        </View>
      </View>

      <View style={[styles.tabs, { borderBottomColor: theme.border }]}> 
        {(['jobs', 'review', 'settings'] as Screen[]).map((item) => (
          <TouchableOpacity key={item} disabled={actions.busy} style={[styles.tab, screen === item && styles.tabActive]} onPress={() => setScreen(item)}>
            <Text style={[styles.tabText, { color: screen === item ? theme.primaryText : theme.text }]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!formVisible ? <ActionNotice theme={theme} state={actions.state} onReload={reload} onAcknowledge={actions.acknowledge} /> : null}

      <View style={{ flex: 1 }} pointerEvents={actions.busy ? 'none' : 'auto'} accessibilityState={{ busy: actions.busy }}>
      {screen === 'jobs' ? (
        <JobsScreen
          theme={theme}
          loading={actions.state.phase === 'loading'}
          jobs={visibleJobs}
          groups={visibleGroups}
          filter={filter}
          onFilter={setFilter}
          sortPreset={sortPreset}
          onSortPreset={setSortPreset}
          groupByLocationEnabled={groupByLocationEnabled}
          onToggleGroupByLocation={() => setGroupByLocationEnabled((value) => !value)}
          onEdit={openEdit}
          onDelete={deleteJob}
          onStatus={setJobStatus}
          onCycleStatus={(job) => setJobStatus(job.id, nextStatus[job.status])}
          onTogglePinned={togglePinned}
          onBump={bumpJob}
          onDuplicate={duplicateJob}
          onChase={chaseJob}
          onClearCompleted={clearCompleted}
          onAdd={openAdd}
          recentLocation={getRecentLocation()}
          compactMode={settings.compactMode}
          shiftStartedAt={settings.currentShiftStartedAt}
          shiftStats={shiftStats}
          onStartShift={startShift}
          onEndShift={endShift}
        />
      ) : null}

      {screen === 'review' ? (
        <HandoverScreen theme={theme} handoverText={handoverText} jobs={jobs} onCopy={copyHandover} onClearCompleted={clearCompleted} onWipeAll={wipeAll} />
      ) : null}

      {screen === 'settings' ? (
        <SettingsScreen theme={theme} disabled={actions.blocked} settings={settings} onSaveHours={saveAutoDeleteHours} onSaveLocationShortcuts={saveLocationShortcuts} onSaveNoteShortcuts={saveNoteShortcuts} onSaveStatusPhraseShortcuts={saveStatusPhraseShortcuts} onSaveCompactMode={saveCompactMode} onSaveAppearanceMode={saveAppearanceMode} onSaveHapticsEnabled={saveHapticsEnabled} onWipeAll={wipeAll} />
      ) : null}
      </View>

      {undoStack.length > 0 ? <UndoBar theme={theme} disabled={actions.blocked} message={undoStack.at(-1)?.message ?? 'Undo available'} onUndo={undoLastChange} onDismiss={() => setUndoStack([])} /> : null}

      <JobFormModal
        visible={formVisible}
        theme={theme}
        form={form}
        pending={actions.busy}
        saveDisabled={actions.blocked}
        notice={<ActionNotice theme={theme} state={actions.state} onReload={reload} onAcknowledge={actions.acknowledge} savedJobs={jobs} />}
        onChange={(next) => { if (!actions.busy) setForm(next); }}
        onClose={() => { if (!actions.busy) setFormVisible(false); }}
        onSave={saveForm}
        locationShortcuts={settings.locationShortcuts}
        noteShortcuts={settings.noteShortcuts}
        statusPhraseShortcuts={settings.statusPhraseShortcuts}
      />
    </SafeAreaView>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
