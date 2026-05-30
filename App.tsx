import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
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
import { JobsScreen, HandoverScreen, SettingsScreen, JobFormModal, UndoBar, JobFormState } from './src/components';
import { darkTheme, lightTheme, styles } from './src/theme';

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

const settingsAppearanceIsDark = (systemScheme: 'light' | 'dark' | null | undefined, appearanceMode: AppearanceMode) => {
  if (appearanceMode === 'dark') return true;
  if (appearanceMode === 'light') return false;
  return systemScheme !== 'light';
};

export default function App() {
  const colorScheme = useColorScheme();
  const [screen, setScreen] = useState<Screen>('jobs');
  const [jobs, setJobs] = useState<ClinicalJob[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ autoDeleteHours: DEFAULT_AUTO_DELETE_HOURS, locationShortcuts: DEFAULT_LOCATION_SHORTCUTS, noteShortcuts: DEFAULT_NOTE_SHORTCUTS, compactMode: DEFAULT_COMPACT_MODE, appearanceMode: DEFAULT_APPEARANCE_MODE, statusPhraseShortcuts: DEFAULT_STATUS_PHRASE_SHORTCUTS, hapticsEnabled: true });
  const dark = settingsAppearanceIsDark(colorScheme, settings.appearanceMode);
  const theme = dark ? darkTheme : lightTheme;
  const [filter, setFilter] = useState<JobFilter>('all');
  const [form, setForm] = useState<JobFormState>(emptyForm);
  const [formVisible, setFormVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [undoStack, setUndoStack] = useState<UndoState[]>([]);
  const [sortPreset, setSortPreset] = useState<SortPreset>('pinnedFirst');
  const [groupByLocationEnabled, setGroupByLocationEnabled] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [storedJobs, storedSettings] = await Promise.all([jobStore.getJobs(), jobStore.getSettings()]);
    setJobs(storedJobs);
    setSettings(storedSettings);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch((error) => Alert.alert('Storage error', String(error)));
  }, [load]);

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
    setUndoStack((stack) => [...stack.slice(-4), { id: `${Date.now()}-${message}`, message, jobs: undoJobs }]);
  };

  const undoLastChange = async () => {
    const undo = undoStack.at(-1);
    if (!undo) return;
    const restored = await jobStore.restoreJobs(undo.jobs);
    setJobs(restored);
    setUndoStack((stack) => stack.slice(0, -1));
    pulse('warning');
  };

  const visibleJobs = useMemo(() => sortJobs(filterJobs(jobs, filter), sortPreset), [jobs, filter, sortPreset]);
  const handoverText = useMemo(() => buildHandoverText(jobs), [jobs]);
  const visibleGroups = useMemo(() => groupByLocationEnabled ? groupJobsByLocation(visibleJobs) : [], [groupByLocationEnabled, visibleJobs]);
  const shiftStats = useMemo(() => ({ active: jobs.filter((job) => job.status !== 'done').length, completed: jobs.filter((job) => job.status === 'done').length, total: jobs.length }), [jobs]);

  const getRecentLocation = () => sortJobs(jobs).find((job) => job.location)?.location ?? '';

  const openAdd = (useRecentLocation = false) => {
    setForm({ ...emptyForm, location: useRecentLocation ? getRecentLocation() : '' });
    setFormVisible(true);
  };

  const openEdit = (job: ClinicalJob) => {
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

  const saveForm = async (keepOpen = false) => {
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
  };

  const setJobStatus = async (id: string, status: JobStatus) => {
    if (status === 'done') {
      const change = await jobStore.setStatusWithUndo(id, status);
      setJobs(change.jobs);
      showUndo('Marked done', change.undoJobs);
      return;
    }
    setJobs(await jobStore.setStatus(id, status));
    pulse('light');
  };

  const togglePinned = async (id: string) => {
    setJobs(await jobStore.togglePinned(id));
    pulse('light');
  };

  const bumpJob = async (id: string) => {
    setJobs(await jobStore.bumpJob(id));
    pulse('light');
  };

  const duplicateJob = async (id: string) => {
    setJobs(await jobStore.duplicateJob(id));
    pulse('success');
  };

  const chaseJob = async (id: string) => {
    setJobs(await jobStore.chaseJob(id));
    pulse('light');
  };

  const startShift = async () => {
    setSettings(await jobStore.startShift());
    pulse('success');
  };

  const endShift = async () => {
    Alert.alert('End local shift?', 'This only clears the shift timer. Jobs stay on this device unless you clear or wipe them.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End shift', onPress: async () => { setSettings(await jobStore.endShift()); pulse('warning'); } },
    ]);
  };

  const saveCompactMode = async (compactMode: boolean) => {
    const next = await jobStore.saveSettings({ ...settings, compactMode });
    setSettings(next);
  };

  const saveAppearanceMode = async (appearanceMode: AppearanceMode) => {
    const next = await jobStore.saveSettings({ ...settings, appearanceMode });
    setSettings(next);
  };

  const saveHapticsEnabled = async (hapticsEnabled: boolean) => {
    const next = await jobStore.saveSettings({ ...settings, hapticsEnabled });
    setSettings(next);
  };

  const saveStatusPhraseShortcuts = async (value: string) => {
    const next = await jobStore.saveSettings({ ...settings, statusPhraseShortcuts: parseShortcutText(value) });
    setSettings(next);
  };

  const deleteJob = (job: ClinicalJob) => {
    Alert.alert('Delete job?', 'This removes the job from this device. You can undo briefly.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const change = await jobStore.deleteJobWithUndo(job.id);
          setJobs(change.jobs);
          showUndo('Deleted job', change.undoJobs);
        },
      },
    ]);
  };

  const clearCompleted = () => {
    Alert.alert('Clear completed jobs?', 'All jobs marked done will be deleted. You can undo briefly.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear done',
        style: 'destructive',
        onPress: async () => {
          const change = await jobStore.clearCompletedWithUndo();
          setJobs(change.jobs);
          showUndo('Cleared completed jobs', change.undoJobs);
        },
      },
    ]);
  };

  const wipeAll = () => {
    Alert.alert('Wipe all local data?', 'This deletes every scratchpad job on this device. You can undo briefly until the undo bar disappears.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Wipe all',
        style: 'destructive',
        onPress: async () => {
          const change = await jobStore.wipeAllWithUndo();
          setJobs(change.jobs);
          showUndo('Wiped all jobs', change.undoJobs);
        },
      },
    ]);
  };

  const saveAutoDeleteHours = async (value: string) => {
    const parsed = Number(value.replace(/[^0-9.]/g, ''));
    const next = await jobStore.saveSettings({ ...settings, autoDeleteHours: parsed });
    setSettings(next);
  };

  const parseShortcutText = (value: string) => value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

  const saveLocationShortcuts = async (value: string) => {
    const next = await jobStore.saveSettings({ ...settings, locationShortcuts: parseShortcutText(value) });
    setSettings(next);
  };

  const saveNoteShortcuts = async (value: string) => {
    const next = await jobStore.saveSettings({ ...settings, noteShortcuts: parseShortcutText(value) });
    setSettings(next);
  };

  const copyHandover = () => {
    Alert.alert(
      'Check identifiers before copying',
      'The clipboard may be visible to other apps or device services. Do not copy excessive patient-identifiable information.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy locally',
          onPress: async () => {
            await Clipboard.setStringAsync(handoverText);
            Alert.alert('Copied', 'Handover text copied to the local clipboard.');
          },
        },
      ],
    );
  };

  return (
    <GestureHandlerRootView style={styles.root}>
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
          <TouchableOpacity key={item} style={[styles.tab, screen === item && styles.tabActive]} onPress={() => setScreen(item)}>
            <Text style={[styles.tabText, { color: screen === item ? '#ffffff' : theme.text }]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {screen === 'jobs' ? (
        <JobsScreen
          theme={theme}
          loading={loading}
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
        <SettingsScreen theme={theme} settings={settings} onSaveHours={saveAutoDeleteHours} onSaveLocationShortcuts={saveLocationShortcuts} onSaveNoteShortcuts={saveNoteShortcuts} onSaveStatusPhraseShortcuts={saveStatusPhraseShortcuts} onSaveCompactMode={saveCompactMode} onSaveAppearanceMode={saveAppearanceMode} onSaveHapticsEnabled={saveHapticsEnabled} onWipeAll={wipeAll} />
      ) : null}

      {undoStack.length > 0 ? <UndoBar theme={theme} message={undoStack.at(-1)?.message ?? 'Undo available'} count={undoStack.length} onUndo={undoLastChange} onDismiss={() => setUndoStack([])} /> : null}

      <JobFormModal
        visible={formVisible}
        theme={theme}
        form={form}
        onChange={setForm}
        onClose={() => setFormVisible(false)}
        onSave={saveForm}
        locationShortcuts={settings.locationShortcuts}
        noteShortcuts={settings.noteShortcuts}
        statusPhraseShortcuts={settings.statusPhraseShortcuts}
      />
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}
