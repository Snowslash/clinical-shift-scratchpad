import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { GestureHandlerRootView, LongPressGestureHandler, State } from 'react-native-gesture-handler';
import { AppSettings, ClinicalJob, DEFAULT_AUTO_DELETE_HOURS, DEFAULT_LOCATION_SHORTCUTS, JobFilter, JobStatus, STATUSES, Urgency } from './src/types/job';
import { jobStore } from './src/services/jobStore';
import { filterJobs, sortJobs } from './src/utils/jobSorting';
import { buildHandoverText } from './src/utils/handover';
import { insertTextShortcut } from './src/utils/textShortcuts';

type Screen = 'jobs' | 'settings';
type JobFormState = {
  id?: string;
  taskText: string;
  patientIdentifier: string;
  location: string;
  urgency: Urgency;
};

type UndoState = {
  message: string;
  jobs: ClinicalJob[];
};

type ShortcutContext = 'taskText' | 'location';

const emptyForm: JobFormState = {
  taskText: '',
  patientIdentifier: '',
  location: '',
  urgency: 'soon',
};

const nextStatus: Record<JobStatus, JobStatus> = {
  pending: 'seen',
  seen: 'waiting',
  waiting: 'done',
  done: 'pending',
};

const urgencyStyle: Record<Urgency, { label: string; color: string; backgroundColor: string }> = {
  urgent: { label: 'urgent', color: '#fecaca', backgroundColor: '#7f1d1d' },
  soon: { label: 'soon', color: '#fde68a', backgroundColor: '#713f12' },
  routine: { label: 'routine', color: '#bfdbfe', backgroundColor: '#1e3a8a' },
};

const statusStyle: Record<JobStatus, { label: string; color: string; backgroundColor: string }> = {
  pending: { label: 'pending', color: '#e5e7eb', backgroundColor: '#374151' },
  seen: { label: 'seen', color: '#bbf7d0', backgroundColor: '#14532d' },
  waiting: { label: 'waiting', color: '#fed7aa', backgroundColor: '#7c2d12' },
  done: { label: 'done', color: '#d1d5db', backgroundColor: '#111827' },
};

export default function App() {
  const colorScheme = useColorScheme();
  const dark = colorScheme !== 'light';
  const theme = dark ? darkTheme : lightTheme;

  const [screen, setScreen] = useState<Screen>('jobs');
  const [jobs, setJobs] = useState<ClinicalJob[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ autoDeleteHours: DEFAULT_AUTO_DELETE_HOURS, locationShortcuts: DEFAULT_LOCATION_SHORTCUTS });
  const [filter, setFilter] = useState<JobFilter>('all');
  const [form, setForm] = useState<JobFormState>(emptyForm);
  const [formVisible, setFormVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [undo, setUndo] = useState<UndoState | null>(null);

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
    if (!undo) return undefined;
    const timer = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(timer);
  }, [undo]);

  const showUndo = (message: string, undoJobs: ClinicalJob[]) => {
    if (undoJobs.length === 0) return;
    setUndo({ message, jobs: undoJobs });
  };

  const undoLastChange = async () => {
    if (!undo) return;
    const restored = await jobStore.restoreJobs(undo.jobs);
    setJobs(restored);
    setUndo(null);
  };

  const visibleJobs = useMemo(() => sortJobs(filterJobs(jobs, filter)), [jobs, filter]);
  const handoverText = useMemo(() => buildHandoverText(jobs), [jobs]);

  const openAdd = () => {
    setForm(emptyForm);
    setFormVisible(true);
  };

  const openEdit = (job: ClinicalJob) => {
    setForm({
      id: job.id,
      taskText: job.taskText,
      patientIdentifier: job.patientIdentifier ?? '',
      location: job.location ?? '',
      urgency: job.urgency,
    });
    setFormVisible(true);
  };

  const saveForm = async () => {
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
      });
      setJobs(next);
    } else {
      const next = await jobStore.addJob({
        taskText,
        patientIdentifier: form.patientIdentifier,
        location: form.location,
        urgency: form.urgency,
      });
      setJobs(next);
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

  const saveLocationShortcuts = async (value: string) => {
    const shortcuts = value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const next = await jobStore.saveSettings({ ...settings, locationShortcuts: shortcuts });
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
        {(['jobs', 'settings'] as Screen[]).map((item) => (
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
          filter={filter}
          onFilter={setFilter}
          onEdit={openEdit}
          onDelete={deleteJob}
          onStatus={setJobStatus}
          onCycleStatus={(job) => setJobStatus(job.id, nextStatus[job.status])}
          onClearCompleted={clearCompleted}
          onAdd={openAdd}
        />
      ) : null}

      {screen === 'settings' ? (
        <SettingsScreen theme={theme} settings={settings} onSaveHours={saveAutoDeleteHours} onSaveLocationShortcuts={saveLocationShortcuts} onWipeAll={wipeAll} />
      ) : null}

      {undo ? <UndoBar theme={theme} message={undo.message} onUndo={undoLastChange} onDismiss={() => setUndo(null)} /> : null}

      <JobFormModal
        visible={formVisible}
        theme={theme}
        form={form}
        onChange={setForm}
        onClose={() => setFormVisible(false)}
        onSave={saveForm}
        locationShortcuts={settings.locationShortcuts}
      />
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}

function JobsScreen({
  theme,
  loading,
  jobs,
  filter,
  onFilter,
  onEdit,
  onDelete,
  onStatus,
  onCycleStatus,
  onClearCompleted,
  onAdd,
}: {
  theme: Theme;
  loading: boolean;
  jobs: ClinicalJob[];
  filter: JobFilter;
  onFilter: (filter: JobFilter) => void;
  onEdit: (job: ClinicalJob) => void;
  onDelete: (job: ClinicalJob) => void;
  onStatus: (id: string, status: JobStatus) => void;
  onCycleStatus: (job: ClinicalJob) => void;
  onClearCompleted: () => void;
  onAdd: () => void;
}) {
  return (
    <View style={styles.body}>
      <View style={styles.filterRow}>
        {(['all', ...STATUSES] as JobFilter[]).map((item) => (
          <TouchableOpacity key={item} style={[styles.filterChip, { borderColor: theme.border }, filter === item && styles.filterChipActive]} onPress={() => onFilter(item)}>
            <Text style={{ color: filter === item ? '#ffffff' : theme.text, fontWeight: '700' }}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={jobs.length === 0 ? styles.emptyList : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>{loading ? 'Loading…' : 'No active jobs'}</Text>
            <Text style={[styles.emptyText, { color: theme.muted }]}>Tap Add. Free text is enough.</Text>
            <TouchableOpacity style={styles.primaryButtonLarge} onPress={onAdd}>
              <Text style={styles.primaryButtonText}>Add first job</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <JobCard
            job={item}
            theme={theme}
            onEdit={() => onEdit(item)}
            onDelete={() => onDelete(item)}
            onStatus={(status) => onStatus(item.id, status)}
            onCycleStatus={() => onCycleStatus(item)}
          />
        )}
      />

      {jobs.length > 0 ? (
        <View style={styles.bottomActionRow}>
          <TouchableOpacity accessibilityRole="button" style={styles.bottomAddButton} onPress={onAdd}>
            <Text style={styles.primaryButtonText}>+ Add</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.clearDoneButton, { borderColor: theme.border }]} onPress={onClearCompleted}>
            <Text style={{ color: theme.text, fontWeight: '700' }}>Clear completed</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function JobCard({ job, theme, onEdit, onDelete, onStatus, onCycleStatus }: { job: ClinicalJob; theme: Theme; onEdit: () => void; onDelete: () => void; onStatus: (status: JobStatus) => void; onCycleStatus: () => void }) {
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, job.status === 'done' && styles.doneCard]}>
      <View style={styles.cardTopRow}>
        <View style={styles.badgeRow}>
          <Badge {...urgencyStyle[job.urgency]} />
          <Pressable onPress={onCycleStatus} hitSlop={10}>
            <Badge {...statusStyle[job.status]} label={`${statusStyle[job.status].label} ↻`} />
          </Pressable>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionButton} onPress={onEdit}><Text style={{ color: theme.text, fontWeight: '700' }}>Edit</Text></TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onDelete}><Text style={{ color: '#fca5a5', fontWeight: '700' }}>Delete</Text></TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.taskText, { color: theme.text }, job.status === 'done' && styles.doneText]}>{job.taskText}</Text>
      <View style={styles.metaRow}>
        {job.location ? <Text style={[styles.metaText, { color: theme.muted }]}>📍 {job.location}</Text> : null}
        {job.patientIdentifier ? <Text style={[styles.metaText, { color: theme.muted }]}>ID: {job.patientIdentifier}</Text> : null}
      </View>

      <View style={styles.statusRow}>
        {STATUSES.map((status) => (
          <TouchableOpacity key={status} style={[styles.statusButton, { borderColor: theme.border }, job.status === status && { backgroundColor: statusStyle[status].backgroundColor }]} onPress={() => onStatus(status)}>
            <Text style={{ color: job.status === status ? statusStyle[status].color : theme.text, fontSize: 11, fontWeight: '800' }}>{status}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function JobFormModal({ visible, theme, form, onChange, onClose, onSave, locationShortcuts }: { visible: boolean; theme: Theme; form: JobFormState; onChange: (form: JobFormState) => void; onClose: () => void; onSave: () => void; locationShortcuts: string[] }) {
  const taskInputRef = useRef<TextInput>(null);
  const locationInputRef = useRef<TextInput>(null);
  const [shortcutMenu, setShortcutMenu] = useState<ShortcutContext | null>(null);

  const openShortcutMenu = (context: ShortcutContext) => {
    if (context === 'taskText') taskInputRef.current?.blur();
    if (context === 'location') locationInputRef.current?.blur();
    setShortcutMenu(context);
  };

  const handleLongPress = (context: ShortcutContext) => ({ nativeEvent }: { nativeEvent: { state: number } }) => {
    if (nativeEvent.state === State.ACTIVE) {
      openShortcutMenu(context);
    }
  };

  const applyTaskShortcut = (shortcut: string) => {
    onChange({ ...form, taskText: insertTextShortcut(form.taskText, shortcut) });
    setShortcutMenu(null);
    requestAnimationFrame(() => taskInputRef.current?.focus());
  };

  const applyLocationShortcut = (shortcut: string) => {
    onChange({ ...form, location: insertTextShortcut(form.location, shortcut) });
    setShortcutMenu(null);
    requestAnimationFrame(() => locationInputRef.current?.focus());
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={[styles.modalSafe, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}> 
          <TouchableOpacity onPress={onSave} style={[styles.modalHeaderButton, styles.modalSaveButton]}><Text style={styles.modalSaveText}>Save</Text></TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.text }]}>{form.id ? 'Edit job' : 'Fast add'}</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalHeaderButton}><Text style={{ color: theme.text, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.formContent}
        >
          <Text style={[styles.label, { color: theme.text }]}>Job note</Text>
          <Text style={[styles.fieldHint, { color: theme.muted }]}>Long-press for note shortcuts including M/F, bloods and common phrases.</Text>
          <LongPressGestureHandler minDurationMs={420} shouldCancelWhenOutside={false} onHandlerStateChange={handleLongPress('taskText')}>
            <View collapsable={false}>
              <TextInput
                ref={taskInputRef}
                value={form.taskText}
                onChangeText={(taskText) => onChange({ ...form, taskText })}
                placeholder="e.g. Review bloods / chase CT / update family"
                placeholderTextColor={theme.placeholder}
                multiline
                scrollEnabled
                style={[styles.mainInput, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
                textAlignVertical="top"
                returnKeyType="default"
              />
            </View>
          </LongPressGestureHandler>

          <Text style={[styles.label, { color: theme.text }]}>Location</Text>
          <Text style={[styles.fieldHint, { color: theme.muted }]}>Long-press for local location shortcuts.</Text>
          <LongPressGestureHandler minDurationMs={420} shouldCancelWhenOutside={false} onHandlerStateChange={handleLongPress('location')}>
            <View collapsable={false}>
              <TextInput
                ref={locationInputRef}
                value={form.location}
                onChangeText={(location) => onChange({ ...form, location })}
                placeholder="Ward / area / bed"
                placeholderTextColor={theme.placeholder}
                style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
              />
            </View>
          </LongPressGestureHandler>

          <Text style={[styles.label, { color: theme.text }]}>Patient identifier optional</Text>
          <Text style={[styles.helpText, { color: theme.muted }]}>Use the minimum necessary identifier for your local shift context. Avoid full details unless genuinely needed.</Text>
          <TextInput
            value={form.patientIdentifier}
            onChangeText={(patientIdentifier) => onChange({ ...form, patientIdentifier })}
            placeholder="Minimum necessary identifier"
            placeholderTextColor={theme.placeholder}
            style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
          />

          <Text style={[styles.label, { color: theme.text }]}>Urgency</Text>
          <View style={styles.segmentedRow}>
            {(['routine', 'soon', 'urgent'] as Urgency[]).map((urgency) => (
              <TouchableOpacity key={urgency} style={[styles.segment, { borderColor: theme.border }, form.urgency === urgency && { backgroundColor: urgencyStyle[urgency].backgroundColor }]} onPress={() => onChange({ ...form, urgency })}>
                <Text style={{ color: form.urgency === urgency ? urgencyStyle[urgency].color : theme.text, fontWeight: '900' }}>{urgency}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <ShortcutMenu
          visible={shortcutMenu !== null}
          theme={theme}
          title={shortcutMenu === 'location' ? 'Location shortcuts' : 'Job note shortcuts'}
          options={shortcutMenu === 'location' ? locationShortcuts : ['M', 'F', 'abdo pain', 'Hb', 'WCC', 'CRP', 'eGFR']}
          onSelect={(shortcut) => (shortcutMenu === 'location' ? applyLocationShortcut(shortcut) : applyTaskShortcut(shortcut))}
          onClose={() => setShortcutMenu(null)}
        />

      </KeyboardAvoidingView>
    </Modal>
  );
}

function HandoverScreen({ theme, handoverText, onCopy }: { theme: Theme; handoverText: string; onCopy: () => void }) {
  return (
    <ScrollView style={styles.body} contentContainerStyle={styles.handoverContent}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Handover review</Text>
      <Text style={[styles.helpText, { color: theme.muted }]}>Plain text summary for quick review. This is not a formal handover record.</Text>
      <View style={[styles.handoverBox, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <Text selectable style={[styles.handoverText, { color: theme.text }]}>{handoverText}</Text>
      </View>
      <TouchableOpacity style={styles.primaryButtonLarge} onPress={onCopy}>
        <Text style={styles.primaryButtonText}>Copy to clipboard</Text>
      </TouchableOpacity>
      <Text style={[styles.warningText, { color: theme.warning }]}>Clipboard warning: copied patient-identifiable information may be exposed outside this app.</Text>
    </ScrollView>
  );
}

function ShortcutMenu({ visible, theme, title, options, onSelect, onClose }: { visible: boolean; theme: Theme; title: string; options: string[]; onSelect: (shortcut: string) => void; onClose: () => void }) {
  const cleanOptions = options.filter(Boolean).slice(0, 8);
  const radius = cleanOptions.length <= 4 ? 82 : 108;
  const center = 136;
  const buttonWidth = 82;
  const buttonHeight = 52;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.shortcutOverlay} onPress={onClose}>
        <Pressable style={[styles.shortcutWheel, { backgroundColor: theme.card, borderColor: theme.border }]}> 
          <Text style={[styles.shortcutTitle, { color: theme.text }]}>{title}</Text>
          <View style={styles.radialMenuStage}>
            {cleanOptions.map((option, index) => {
              const angle = -Math.PI / 2 + (index * 2 * Math.PI) / cleanOptions.length;
              const left = center + radius * Math.cos(angle) - buttonWidth / 2;
              const top = center + radius * Math.sin(angle) - buttonHeight / 2;

              return (
                <TouchableOpacity
                  key={option}
                  accessibilityRole="button"
                  style={[styles.shortcutOptionButton, { left, top, width: buttonWidth, height: buttonHeight, borderColor: theme.border, backgroundColor: theme.background }]}
                  onPress={() => onSelect(option)}
                >
                  <Text style={[styles.shortcutOptionText, { color: theme.text }]} numberOfLines={2}>{option}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity accessibilityRole="button" style={[styles.shortcutCenterButton, { borderColor: theme.border, backgroundColor: theme.background }]} onPress={onClose}>
              <Text style={[styles.shortcutDismissText, { color: theme.muted }]}>cancel</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.shortcutHintBottom, { color: theme.muted }]}>Tap an item, or outside to cancel</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function UndoBar({ theme, message, onUndo, onDismiss }: { theme: Theme; message: string; onUndo: () => void; onDismiss: () => void }) {
  return (
    <View style={[styles.undoBar, { backgroundColor: theme.undoBackground, borderColor: theme.border }]}> 
      <Text style={[styles.undoText, { color: theme.text }]} numberOfLines={1}>{message}</Text>
      <TouchableOpacity accessibilityRole="button" style={styles.undoButton} onPress={onUndo}>
        <Text style={styles.undoButtonText}>Undo</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" style={styles.undoDismiss} onPress={onDismiss}>
        <Text style={[styles.undoDismissText, { color: theme.muted }]}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

function SettingsScreen({ theme, settings, onSaveHours, onSaveLocationShortcuts, onWipeAll }: { theme: Theme; settings: AppSettings; onSaveHours: (value: string) => void; onSaveLocationShortcuts: (value: string) => void; onWipeAll: () => void }) {
  const [hoursText, setHoursText] = useState(String(settings.autoDeleteHours));
  const [locationShortcutsText, setLocationShortcutsText] = useState(settings.locationShortcuts.join(', '));

  useEffect(() => setHoursText(String(settings.autoDeleteHours)), [settings.autoDeleteHours]);
  useEffect(() => setLocationShortcutsText(settings.locationShortcuts.join(', ')), [settings.locationShortcuts]);

  return (
    <ScrollView style={styles.body} contentContainerStyle={styles.settingsContent}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Settings and privacy</Text>

      <View style={[styles.settingsCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <Text style={[styles.label, { color: theme.text }]}>Auto-delete interval in hours</Text>
        <TextInput
          keyboardType="numeric"
          value={hoursText}
          onChangeText={setHoursText}
          onBlur={() => onSaveHours(hoursText)}
          style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
        />
        <Text style={[styles.helpText, { color: theme.muted }]}>Default is 24 hours. Existing jobs keep their current expiry time.</Text>
      </View>

      <View style={[styles.settingsCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <Text style={[styles.label, { color: theme.text }]}>Location shortcuts</Text>
        <TextInput
          value={locationShortcutsText}
          onChangeText={setLocationShortcutsText}
          onBlur={() => onSaveLocationShortcuts(locationShortcutsText)}
          placeholder="TCI, A7, C5"
          placeholderTextColor={theme.placeholder}
          style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
        />
        <Text style={[styles.helpText, { color: theme.muted }]}>Comma-separated local shortcuts shown when long-pressing the location field. Keep them ward/area labels only.</Text>
      </View>

      <View style={[styles.settingsCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <Text style={[styles.sectionSubtitle, { color: theme.text }]}>Not a medical record</Text>
        <Text style={[styles.helpText, { color: theme.muted }]}>This is an unofficial temporary scratchpad for shift work. Do not rely on it instead of formal records, safety-critical escalation, or proper handover.</Text>
      </View>

      <View style={[styles.settingsCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <Text style={[styles.sectionSubtitle, { color: theme.text }]}>Local-only temporary storage</Text>
        <Text style={[styles.helpText, { color: theme.muted }]}>Jobs persist on this device after app restart and auto-expire locally. There is no backend, account, cloud sync, analytics, remote logging, messaging, or EHR integration.</Text>
      </View>

      <View style={[styles.settingsCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <Text style={[styles.sectionSubtitle, { color: theme.text }]}>Known limitations</Text>
        <Text style={[styles.helpText, { color: theme.muted }]}>This prototype uses encrypted local storage through Expo SecureStore on native platforms. Phone loss, unlocked devices, OS backups, screenshots, and clipboard use remain risks. This prototype is not NHS-approved, not GDPR-assured, not clinically safety-assured, and not production-ready.</Text>
      </View>

      <TouchableOpacity style={styles.dangerButton} onPress={onWipeAll}>
        <Text style={styles.dangerButtonText}>Wipe all local jobs</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Badge({ label, color, backgroundColor }: { label: string; color: string; backgroundColor: string }) {
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

type Theme = typeof darkTheme;

const darkTheme = {
  background: '#0b1120',
  card: '#111827',
  text: '#f9fafb',
  muted: '#9ca3af',
  border: '#263244',
  placeholder: '#6b7280',
  warning: '#fbbf24',
  undoBackground: '#111827',
};

const lightTheme = {
  background: '#f8fafc',
  card: '#ffffff',
  text: '#111827',
  muted: '#4b5563',
  border: '#d1d5db',
  placeholder: '#9ca3af',
  warning: '#92400e',
  undoBackground: '#ffffff',
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 13, marginTop: 2 },
  primaryButton: { backgroundColor: '#2563eb', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, minHeight: 46, justifyContent: 'center' },
  primaryButtonLarge: { backgroundColor: '#2563eb', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14, minHeight: 50, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: '#ffffff', fontWeight: '900', fontSize: 16 },
  tabs: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, gap: 8 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  tabActive: { backgroundColor: '#1f2937' },
  tabText: { fontWeight: '900', textTransform: 'capitalize' },
  body: { flex: 1, paddingHorizontal: 10 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 8 },
  filterChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, minHeight: 36 },
  filterChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  listContent: { paddingBottom: 132 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 22, fontWeight: '900' },
  emptyText: { marginTop: 6, fontSize: 15 },
  card: { borderWidth: 1, borderRadius: 14, padding: 10, marginBottom: 8 },
  doneCard: { opacity: 0.72 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontWeight: '900', fontSize: 10, textTransform: 'uppercase' },
  cardActions: { flexDirection: 'row', gap: 4 },
  actionButton: { paddingVertical: 6, paddingHorizontal: 6, minHeight: 34, justifyContent: 'center' },
  taskText: { fontSize: 16, fontWeight: '800', lineHeight: 21, marginTop: 8 },
  doneText: { textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  metaText: { fontSize: 12, fontWeight: '700' },
  statusRow: { flexDirection: 'row', gap: 5, marginTop: 8 },
  statusButton: { flex: 1, borderWidth: 1, borderRadius: 8, minHeight: 34, alignItems: 'center', justifyContent: 'center' },
  bottomActionRow: { position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', gap: 8 },
  bottomAddButton: { flex: 1, backgroundColor: '#2563eb', borderRadius: 14, padding: 14, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  clearDoneButton: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, alignItems: 'center', backgroundColor: 'rgba(31,41,55,0.92)', minHeight: 52, justifyContent: 'center' },
  modalSafe: { flex: 1 },
  modalHeader: { height: 60, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  modalHeaderButton: { minWidth: 78, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  modalSaveButton: { backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 12 },
  modalSaveText: { color: '#ffffff', fontWeight: '900', fontSize: 16 },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  formContent: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 180 },
  label: { fontSize: 14, fontWeight: '900', marginBottom: 6, marginTop: 10 },
  fieldHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, marginBottom: 6 },
  fieldHeaderLabel: { marginTop: 0, marginBottom: 0 },
  shortcutTriggerButton: { borderWidth: 1, borderRadius: 999, minHeight: 38, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  shortcutTriggerText: { fontSize: 13, fontWeight: '900' },
  fieldHint: { fontSize: 12, fontWeight: '700', marginTop: -2, marginBottom: 6 },

  shortcutOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.52)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  shortcutWheel: { width: '92%', maxWidth: 380, borderWidth: 1, borderRadius: 24, padding: 16, alignItems: 'center' },
  shortcutTitle: { fontSize: 18, fontWeight: '900', marginBottom: 12 },
  radialMenuStage: { width: 272, height: 272, position: 'relative' },
  shortcutOptionButton: { position: 'absolute', borderWidth: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  shortcutOptionText: { fontSize: 15, fontWeight: '900', textAlign: 'center' },
  shortcutCenterButton: { position: 'absolute', left: 94, top: 104, width: 84, height: 64, borderWidth: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  shortcutDismissText: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  shortcutHintBottom: { fontSize: 12, fontWeight: '700', marginTop: 10 },
  helpText: { fontSize: 14, lineHeight: 20 },
  mainInput: { minHeight: 112, maxHeight: 180, borderWidth: 1, borderRadius: 16, padding: 12, fontSize: 18, lineHeight: 24 },
  input: { borderWidth: 1, borderRadius: 14, padding: 13, minHeight: 48, fontSize: 16 },
  segmentedRow: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, borderWidth: 1, borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  handoverContent: { paddingVertical: 16, paddingBottom: 42 },
  sectionTitle: { fontSize: 22, fontWeight: '900', marginBottom: 8 },
  sectionSubtitle: { fontSize: 17, fontWeight: '900', marginBottom: 8 },
  handoverBox: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 14 },
  handoverText: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 15, lineHeight: 22 },
  undoBar: { position: 'absolute', left: 12, right: 12, bottom: 74, borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingLeft: 14, paddingRight: 8, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 10, elevation: 6 },
  undoText: { flex: 1, fontSize: 14, fontWeight: '800' },
  undoButton: { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 14, minHeight: 36, justifyContent: 'center' },
  undoButtonText: { color: '#ffffff', fontWeight: '900' },
  undoDismiss: { minWidth: 34, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  undoDismissText: { fontSize: 24, fontWeight: '700' },
  warningText: { fontSize: 13, lineHeight: 18, marginTop: 12, fontWeight: '700' },
  settingsContent: { paddingVertical: 16, paddingBottom: 42 },
  settingsCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 12 },
  dangerButton: { backgroundColor: '#991b1b', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 18, minHeight: 52, justifyContent: 'center' },
  dangerButtonText: { color: '#fee2e2', fontWeight: '900', fontSize: 16 },
});
