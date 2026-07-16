import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LongPressGestureHandler, State } from 'react-native-gesture-handler';
import { APPEARANCE_MODES, AppearanceMode, AppSettings, ClinicalJob, DEFAULT_APPEARANCE_MODE, DEFAULT_AUTO_DELETE_HOURS, DEFAULT_COMPACT_MODE, DEFAULT_LOCATION_SHORTCUTS, DEFAULT_NOTE_SHORTCUTS, DEFAULT_STATUS_PHRASE_SHORTCUTS, MAX_RADIAL_NOTE_SHORTCUTS, JobFilter, JobStatus, JobType, JOB_TYPES, SORT_PRESETS, SortPreset, STATUSES, Urgency } from './types/job';
import { insertTextShortcut } from './utils/textShortcuts';
import { styles, Theme } from './theme';

export type JobFormState = {
  id?: string;
  taskText: string;
  patientIdentifier: string;
  location: string;
  urgency: Urgency;
  jobType?: JobType;
  waitingFor: string;
};

type ShortcutContext = 'taskText' | 'location' | 'waitingFor';

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

const jobTypeLabels: Record<JobType, string> = {
  review: 'review',
  bloods: 'bloods',
  imaging: 'imaging',
  call: 'call',
  family: 'family',
  discharge: 'discharge',
  prescribing: 'Rx',
  handover: 'handover',
};

const appearanceLabels: Record<AppearanceMode, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

const formatAge = (iso: string, nowMs = Date.now()) => {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'unknown';
  const minutes = Math.max(0, Math.floor((nowMs - then) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours < 24) return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

function JobsScreen({
  theme,
  loading,
  jobs,
  groups,
  filter,
  onFilter,
  sortPreset,
  onSortPreset,
  groupByLocationEnabled,
  onToggleGroupByLocation,
  onEdit,
  onDelete,
  onStatus,
  onCycleStatus,
  onTogglePinned,
  onBump,
  onDuplicate,
  onChase,
  onClearCompleted,
  onAdd,
  recentLocation,
  compactMode,
  shiftStartedAt,
  shiftStats,
  onStartShift,
  onEndShift,
}: {
  theme: Theme;
  loading: boolean;
  jobs: ClinicalJob[];
  groups: { location: string; jobs: ClinicalJob[] }[];
  filter: JobFilter;
  onFilter: (filter: JobFilter) => void;
  sortPreset: SortPreset;
  onSortPreset: (preset: SortPreset) => void;
  groupByLocationEnabled: boolean;
  onToggleGroupByLocation: () => void;
  onEdit: (job: ClinicalJob) => void;
  onDelete: (job: ClinicalJob) => void;
  onStatus: (id: string, status: JobStatus) => void;
  onCycleStatus: (job: ClinicalJob) => void;
  onTogglePinned: (id: string) => void;
  onBump: (id: string) => void;
  onDuplicate: (id: string) => void;
  onChase: (id: string) => void;
  onClearCompleted: () => void;
  onAdd: (useRecentLocation?: boolean) => void;
  recentLocation: string;
  compactMode: boolean;
  shiftStartedAt?: string;
  shiftStats: { active: number; completed: number; total: number };
  onStartShift: () => void;
  onEndShift: () => void;
}) {
  const renderJob = (item: ClinicalJob) => (
    <JobCard
      job={item}
      theme={theme}
      compactMode={compactMode}
      onEdit={() => onEdit(item)}
      onDelete={() => onDelete(item)}
      onStatus={(status) => onStatus(item.id, status)}
      onCycleStatus={() => onCycleStatus(item)}
      onTogglePinned={() => onTogglePinned(item.id)}
      onBump={() => onBump(item.id)}
      onDuplicate={() => onDuplicate(item.id)}
      onChase={() => onChase(item.id)}
    />
  );

  return (
    <View style={styles.body}>
      <View style={[styles.shiftCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <View style={styles.settingsRowBetween}>
          <View style={styles.settingsRowText}>
            <Text style={[styles.sectionSubtitle, { color: theme.text }]}>Shift mode</Text>
            <Text style={[styles.helpText, { color: theme.muted }]}>{shiftStartedAt ? `Started ${formatAge(shiftStartedAt)} ago · ${shiftStats.active} active · ${shiftStats.completed} done` : 'No local shift timer running'}</Text>
          </View>
          <TouchableOpacity style={[styles.toggleButton, { borderColor: theme.border }, shiftStartedAt && styles.toggleButtonActive]} onPress={shiftStartedAt ? onEndShift : onStartShift}>
            <Text style={{ color: shiftStartedAt ? '#ffffff' : theme.text, fontWeight: '900' }}>{shiftStartedAt ? 'End' : 'Start'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalControls} contentContainerStyle={styles.horizontalControlContent}>
        {(['all', ...STATUSES] as JobFilter[]).map((item) => (
          <TouchableOpacity key={item} style={[styles.filterChip, { borderColor: theme.border }, filter === item && styles.filterChipActive]} onPress={() => onFilter(item)}>
            <Text style={{ color: filter === item ? '#ffffff' : theme.text, fontWeight: '700' }}>{item}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalControls} contentContainerStyle={styles.horizontalControlContent}>
        {SORT_PRESETS.map((preset) => (
          <TouchableOpacity key={preset} style={[styles.filterChip, { borderColor: theme.border }, sortPreset === preset && styles.filterChipActive]} onPress={() => onSortPreset(preset)}>
            <Text style={{ color: sortPreset === preset ? '#ffffff' : theme.text, fontWeight: '700' }}>{preset.replace(/([A-Z])/g, ' $1').toLowerCase()}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.filterChip, { borderColor: theme.border }, groupByLocationEnabled && styles.filterChipActive]} onPress={onToggleGroupByLocation}>
          <Text style={{ color: groupByLocationEnabled ? '#ffffff' : theme.text, fontWeight: '700' }}>group location</Text>
        </TouchableOpacity>
      </ScrollView>

      <FlatList<ClinicalJob | { location: string; jobs: ClinicalJob[] }>
        data={groupByLocationEnabled ? groups : jobs}
        keyExtractor={(item) => groupByLocationEnabled ? `group-${(item as unknown as { location: string }).location}` : (item as ClinicalJob).id}
        contentContainerStyle={jobs.length === 0 ? styles.emptyList : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>{loading ? 'Loading…' : 'No active jobs'}</Text>
            <Text style={[styles.emptyText, { color: theme.muted }]}>Tap Add. Free text is enough.</Text>
            <TouchableOpacity style={styles.primaryButtonLarge} onPress={() => onAdd(false)}>
              <Text style={styles.primaryButtonText}>Add first job</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => groupByLocationEnabled ? (
          <View>
            <Text style={[styles.groupHeader, { color: theme.text, borderBottomColor: theme.border }]}>{(item as unknown as { location: string; jobs: ClinicalJob[] }).location}</Text>
            {(item as unknown as { location: string; jobs: ClinicalJob[] }).jobs.map((job) => <View key={job.id}>{renderJob(job)}</View>)}
          </View>
        ) : renderJob(item as ClinicalJob)}
      />

      {jobs.length > 0 ? (
        <View style={styles.bottomActionColumn}>
          {recentLocation ? (
            <TouchableOpacity accessibilityRole="button" style={[styles.sameLocationButton, { borderColor: theme.border, backgroundColor: theme.secondaryActionBackground }]} onPress={() => onAdd(true)}>
              <Text style={{ color: theme.secondaryActionText, fontWeight: '900' }}>+ Same location: {recentLocation}</Text>
            </TouchableOpacity>
          ) : null}
          <View style={styles.bottomActionRow}>
            <TouchableOpacity accessibilityRole="button" style={styles.bottomAddButton} onPress={() => onAdd(false)}>
              <Text style={styles.primaryButtonText}>+ Quick capture</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.clearDoneButton, { borderColor: theme.border, backgroundColor: theme.secondaryActionBackground }]} onPress={onClearCompleted}>
              <Text style={{ color: theme.secondaryActionText, fontWeight: '800' }}>Clear completed</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function JobCard({ job, theme, compactMode, onEdit, onDelete, onStatus, onCycleStatus, onTogglePinned, onBump, onDuplicate, onChase }: { job: ClinicalJob; theme: Theme; compactMode: boolean; onEdit: () => void; onDelete: () => void; onStatus: (status: JobStatus) => void; onCycleStatus: () => void; onTogglePinned: () => void; onBump: () => void; onDuplicate: () => void; onChase: () => void }) {
  const updatedLabel = job.status === 'waiting' ? `waiting ${formatAge(job.updatedAt)}` : `updated ${formatAge(job.updatedAt)}`;
  return (
    <View style={[styles.card, compactMode && styles.compactCard, { backgroundColor: theme.card, borderColor: theme.border }, job.status === 'done' && styles.doneCard, job.pinned && styles.pinnedCard]}>
      <View style={styles.cardTopRow}>
        <View style={styles.badgeRow}>
          {job.pinned ? <Badge label="pinned" color="#fef3c7" backgroundColor="#92400e" /> : null}
          <Badge {...urgencyStyle[job.urgency]} />
          <Pressable onPress={onCycleStatus} hitSlop={10}>
            <Badge {...statusStyle[job.status]} label={`${statusStyle[job.status].label} ↻`} />
          </Pressable>
          {job.jobType ? <Badge label={jobTypeLabels[job.jobType]} color="#dbeafe" backgroundColor="#1e40af" /> : null}
          {job.chaseCount ? <Badge label={`chased ${job.chaseCount}`} color="#e0e7ff" backgroundColor="#3730a3" /> : null}
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.iconActionButton} onPress={onTogglePinned}><Text style={{ color: job.pinned ? '#fbbf24' : theme.text, fontWeight: '900' }}>{job.pinned ? '★' : '☆'}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onEdit}><Text style={{ color: theme.text, fontWeight: '700' }}>Edit</Text></TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onDelete}><Text style={{ color: '#fca5a5', fontWeight: '700' }}>Del</Text></TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.taskText, compactMode && styles.compactTaskText, { color: theme.text }, job.status === 'done' && styles.doneText]} numberOfLines={compactMode ? 2 : undefined}>{job.taskText}</Text>
      {job.waitingFor ? <Text style={[styles.waitingText, { color: theme.warning }]} numberOfLines={compactMode ? 1 : 2}>Waiting for: {job.waitingFor}</Text> : null}
      <View style={styles.metaRow}>
        {job.location ? <Text style={[styles.metaText, { color: theme.muted }]}>📍 {job.location}</Text> : null}
        {job.patientIdentifier ? <Text style={[styles.metaText, { color: theme.muted }]}>ID: {job.patientIdentifier}</Text> : null}
        <Text style={[styles.metaText, { color: theme.muted }]}>⏱ {updatedLabel}</Text>
        {job.lastChasedAt ? <Text style={[styles.metaText, { color: theme.muted }]}>↪ chased {formatAge(job.lastChasedAt)}</Text> : null}
      </View>

      <View style={styles.statusRow}>
        {STATUSES.map((status) => (
          <TouchableOpacity key={status} style={[styles.statusButton, compactMode && styles.compactStatusButton, { borderColor: theme.border }, job.status === status && { backgroundColor: statusStyle[status].backgroundColor }]} onPress={() => onStatus(status)}>
            <Text style={{ color: job.status === status ? statusStyle[status].color : theme.text, fontSize: 12, fontWeight: '800' }}>{status}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.cardUtilityRow}>
        <TouchableOpacity style={[styles.utilityButton, { borderColor: theme.border }]} onPress={onBump}>
          <Text style={{ color: theme.text, fontWeight: '800' }}>Bump</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.utilityButton, { borderColor: theme.border }]} onPress={onChase}>
          <Text style={{ color: theme.text, fontWeight: '800' }}>Chase</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.utilityButton, { borderColor: theme.border }]} onPress={onDuplicate}>
          <Text style={{ color: theme.text, fontWeight: '800' }}>Duplicate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function JobFormModal({ visible, theme, form, onChange, onClose, onSave, locationShortcuts, noteShortcuts, statusPhraseShortcuts }: { visible: boolean; theme: Theme; form: JobFormState; onChange: (form: JobFormState) => void; onClose: () => void; onSave: (keepOpen?: boolean) => void; locationShortcuts: string[]; noteShortcuts: string[]; statusPhraseShortcuts: string[] }) {
  const taskInputRef = useRef<TextInput>(null);
  const locationInputRef = useRef<TextInput>(null);
  const waitingInputRef = useRef<TextInput>(null);
  const [shortcutMenu, setShortcutMenu] = useState<ShortcutContext | null>(null);

  const openShortcutMenu = (context: ShortcutContext) => {
    if (context === 'taskText') taskInputRef.current?.blur();
    if (context === 'location') locationInputRef.current?.blur();
    if (context === 'waitingFor') waitingInputRef.current?.blur();
    setShortcutMenu(context);
  };

  const handleLongPress = (context: ShortcutContext) => ({ nativeEvent }: { nativeEvent: { state: number } }) => {
    if (nativeEvent.state === State.ACTIVE) openShortcutMenu(context);
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

  const applyWaitingShortcut = (shortcut: string) => {
    onChange({ ...form, waitingFor: insertTextShortcut(form.waitingFor, shortcut) });
    setShortcutMenu(null);
    requestAnimationFrame(() => waitingInputRef.current?.focus());
  };

  const menuTitle = shortcutMenu === 'location' ? 'Location shortcuts' : shortcutMenu === 'waitingFor' ? 'Waiting/status phrases' : 'Job note shortcuts';
  const menuOptions = shortcutMenu === 'location' ? locationShortcuts : shortcutMenu === 'waitingFor' ? statusPhraseShortcuts : noteShortcuts;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <KeyboardAvoidingView style={[styles.modalSafe, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}> 
          <TouchableOpacity onPress={() => onSave(false)} style={[styles.modalHeaderButton, styles.modalSaveButton]}><Text style={styles.modalSaveText}>Save</Text></TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.text }]}>{form.id ? 'Edit job' : 'Quick capture'}</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalHeaderButton}><Text style={{ color: theme.text, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.formContent}>
          <Text style={[styles.label, { color: theme.text }]}>Job note</Text>
          <Text style={[styles.fieldHint, { color: theme.muted }]}>Long-press for your first 8 note shortcut favourites.</Text>
          <LongPressGestureHandler minDurationMs={420} shouldCancelWhenOutside={false} onHandlerStateChange={handleLongPress('taskText')}>
            <View collapsable={false}>
              <TextInput ref={taskInputRef} value={form.taskText} onChangeText={(taskText) => onChange({ ...form, taskText })} placeholder="e.g. Review bloods / chase CT / update family" placeholderTextColor={theme.placeholder} multiline scrollEnabled style={[styles.mainInput, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]} textAlignVertical="top" returnKeyType="default" />
            </View>
          </LongPressGestureHandler>

          <Text style={[styles.label, { color: theme.text }]}>Waiting for optional</Text>
          <Text style={[styles.fieldHint, { color: theme.muted }]}>Plain status phrase only. Long-press for local phrases.</Text>
          <LongPressGestureHandler minDurationMs={420} shouldCancelWhenOutside={false} onHandlerStateChange={handleLongPress('waitingFor')}>
            <View collapsable={false}>
              <TextInput ref={waitingInputRef} value={form.waitingFor} onChangeText={(waitingFor) => onChange({ ...form, waitingFor })} placeholder="CT report / bloods / reg review" placeholderTextColor={theme.placeholder} style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]} />
            </View>
          </LongPressGestureHandler>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalControls} contentContainerStyle={styles.horizontalControlContent}>
            {statusPhraseShortcuts.slice(0, 8).map((phrase) => (
              <TouchableOpacity key={phrase} style={[styles.filterChip, { borderColor: theme.border }]} onPress={() => onChange({ ...form, waitingFor: insertTextShortcut(form.waitingFor, phrase) })}>
                <Text style={{ color: theme.text, fontWeight: '700' }}>{phrase}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.label, { color: theme.text }]}>Location</Text>
          <Text style={[styles.fieldHint, { color: theme.muted }]}>Long-press for local location shortcuts.</Text>
          <LongPressGestureHandler minDurationMs={420} shouldCancelWhenOutside={false} onHandlerStateChange={handleLongPress('location')}>
            <View collapsable={false}>
              <TextInput ref={locationInputRef} value={form.location} onChangeText={(location) => onChange({ ...form, location })} placeholder="Ward / area / bed" placeholderTextColor={theme.placeholder} style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]} />
            </View>
          </LongPressGestureHandler>

          <Text style={[styles.label, { color: theme.text }]}>Patient identifier optional</Text>
          <Text style={[styles.helpText, { color: theme.muted }]}>Use the minimum necessary identifier for your local shift context. Avoid full details unless genuinely needed.</Text>
          <TextInput value={form.patientIdentifier} onChangeText={(patientIdentifier) => onChange({ ...form, patientIdentifier })} placeholder="Minimum necessary identifier" placeholderTextColor={theme.placeholder} style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]} />

          <Text style={[styles.label, { color: theme.text }]}>Job type optional</Text>
          <Text style={[styles.fieldHint, { color: theme.muted }]}>Plain local label only — not triage, priority, or decision support.</Text>
          <View style={styles.typeChipRow}>
            {JOB_TYPES.map((jobType) => (
              <TouchableOpacity key={jobType} style={[styles.typeChip, { borderColor: theme.border }, form.jobType === jobType && styles.typeChipActive]} onPress={() => onChange({ ...form, jobType: form.jobType === jobType ? undefined : jobType })}>
                <Text style={{ color: form.jobType === jobType ? '#ffffff' : theme.text, fontWeight: '900' }}>{jobTypeLabels[jobType]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: theme.text }]}>Urgency</Text>
          <View style={styles.segmentedRow}>
            {(['routine', 'soon', 'urgent'] as Urgency[]).map((urgency) => (
              <TouchableOpacity key={urgency} style={[styles.segment, { borderColor: theme.border }, form.urgency === urgency && { backgroundColor: urgencyStyle[urgency].backgroundColor }]} onPress={() => onChange({ ...form, urgency })}>
                <Text style={{ color: form.urgency === urgency ? urgencyStyle[urgency].color : theme.text, fontWeight: '900' }}>{urgency}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {!form.id ? (
            <TouchableOpacity style={styles.primaryButtonLarge} onPress={() => onSave(true)}>
              <Text style={styles.primaryButtonText}>Add + keep open</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>

        <ShortcutMenu visible={shortcutMenu !== null} theme={theme} title={menuTitle} options={menuOptions} onSelect={(shortcut) => shortcutMenu === 'location' ? applyLocationShortcut(shortcut) : shortcutMenu === 'waitingFor' ? applyWaitingShortcut(shortcut) : applyTaskShortcut(shortcut)} onClose={() => setShortcutMenu(null)} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function HandoverScreen({ theme, handoverText, jobs, onCopy, onClearCompleted, onWipeAll }: { theme: Theme; handoverText: string; jobs: ClinicalJob[]; onCopy: () => void; onClearCompleted: () => void; onWipeAll: () => void }) {
  const active = jobs.filter((job) => job.status !== 'done');
  const completed = jobs.filter((job) => job.status === 'done');
  return (
    <ScrollView style={styles.body} contentContainerStyle={styles.handoverContent}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>End-of-shift review</Text>
      <Text style={[styles.helpText, { color: theme.muted }]}>Review active versus completed local scratchpad jobs before clearing. This is not a formal handover record.</Text>
      <View style={[styles.settingsCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <Text style={[styles.sectionSubtitle, { color: theme.text }]}>Still active ({active.length})</Text>
        {active.length ? active.map((job) => <Text key={job.id} style={[styles.reviewLine, { color: theme.text }]}>• {job.taskText}{job.waitingFor ? ` — waiting for ${job.waitingFor}` : ''}</Text>) : <Text style={[styles.helpText, { color: theme.muted }]}>No active jobs.</Text>}
      </View>
      <View style={[styles.settingsCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <Text style={[styles.sectionSubtitle, { color: theme.text }]}>Completed ({completed.length})</Text>
        {completed.length ? completed.map((job) => <Text key={job.id} style={[styles.reviewLine, { color: theme.text }]}>• {job.taskText}</Text>) : <Text style={[styles.helpText, { color: theme.muted }]}>No completed jobs.</Text>}
      </View>
      <View style={[styles.handoverBox, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <Text selectable style={[styles.handoverText, { color: theme.text }]}>{handoverText}</Text>
      </View>
      <TouchableOpacity style={styles.primaryButtonLarge} onPress={onCopy}>
        <Text style={styles.primaryButtonText}>Copy plain text summary</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.clearDoneButton, { borderColor: theme.border, backgroundColor: theme.secondaryActionBackground, marginTop: 12 }]} onPress={onClearCompleted}>
        <Text style={{ color: theme.secondaryActionText, fontWeight: '900' }}>Clear completed</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.dangerButton} onPress={onWipeAll}>
        <Text style={styles.dangerButtonText}>Wipe all local jobs</Text>
      </TouchableOpacity>
      <Text style={[styles.warningText, { color: theme.warning }]}>Clipboard warning: copied patient-identifiable information may be exposed outside this app.</Text>
    </ScrollView>
  );
}

function ShortcutMenu({ visible, theme, title, options, onSelect, onClose }: { visible: boolean; theme: Theme; title: string; options: string[]; onSelect: (shortcut: string) => void; onClose: () => void }) {
  const cleanOptions = options.filter(Boolean).slice(0, MAX_RADIAL_NOTE_SHORTCUTS);
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

function UndoBar({ theme, message, count, onUndo, onDismiss }: { theme: Theme; message: string; count: number; onUndo: () => void; onDismiss: () => void }) {
  return (
    <View style={[styles.undoBar, { backgroundColor: theme.undoBackground, borderColor: theme.border }]}> 
      <Text style={[styles.undoText, { color: theme.text }]} numberOfLines={1}>{message}{count > 1 ? ` · ${count} undo steps` : ''}</Text>
      <TouchableOpacity accessibilityRole="button" style={styles.undoButton} onPress={onUndo}>
        <Text style={styles.undoButtonText}>Undo</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" style={styles.undoDismiss} onPress={onDismiss}>
        <Text style={[styles.undoDismissText, { color: theme.muted }]}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

function SettingsScreen({ theme, settings, onSaveHours, onSaveLocationShortcuts, onSaveNoteShortcuts, onSaveStatusPhraseShortcuts, onSaveCompactMode, onSaveAppearanceMode, onSaveHapticsEnabled, onWipeAll }: { theme: Theme; settings: AppSettings; onSaveHours: (value: string) => void; onSaveLocationShortcuts: (value: string) => void; onSaveNoteShortcuts: (value: string) => void; onSaveStatusPhraseShortcuts: (value: string) => void; onSaveCompactMode: (compactMode: boolean) => void; onSaveAppearanceMode: (appearanceMode: AppearanceMode) => void; onSaveHapticsEnabled: (enabled: boolean) => void; onWipeAll: () => void }) {
  const [hoursText, setHoursText] = useState(String(settings.autoDeleteHours));
  const [locationShortcutsText, setLocationShortcutsText] = useState(() => settings.locationShortcuts.join(', '));
  const [noteShortcutsText, setNoteShortcutsText] = useState(() => settings.noteShortcuts.join(', '));
  const [statusPhraseText, setStatusPhraseText] = useState(() => settings.statusPhraseShortcuts.join(', '));

  useEffect(() => setHoursText(String(settings.autoDeleteHours)), [settings.autoDeleteHours]);
  useEffect(() => setLocationShortcutsText(settings.locationShortcuts.join(', ')), [settings.locationShortcuts]);
  useEffect(() => setNoteShortcutsText(settings.noteShortcuts.join(', ')), [settings.noteShortcuts]);
  useEffect(() => setStatusPhraseText(settings.statusPhraseShortcuts.join(', ')), [settings.statusPhraseShortcuts]);

  return (
    <ScrollView style={styles.body} contentContainerStyle={styles.settingsContent}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Settings and privacy</Text>

      <View style={[styles.settingsCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <Text style={[styles.label, { color: theme.text }]}>Appearance</Text>
        <Text style={[styles.helpText, { color: theme.muted }]}>Choose system, light, or dark. Dark mode is useful on-call and does not change stored data.</Text>
        <View style={styles.segmentedRow}>
          {APPEARANCE_MODES.map((mode) => (
            <TouchableOpacity key={mode} style={[styles.segment, { borderColor: theme.border }, settings.appearanceMode === mode && styles.typeChipActive]} onPress={() => onSaveAppearanceMode(mode)}>
              <Text style={{ color: settings.appearanceMode === mode ? '#ffffff' : theme.text, fontWeight: '900' }}>{appearanceLabels[mode]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

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
        <View style={styles.settingsRowBetween}>
          <View style={styles.settingsRowText}>
            <Text style={[styles.label, { color: theme.text }]}>Compact card mode</Text>
            <Text style={[styles.helpText, { color: theme.muted }]}>Denser job cards for real shifts with longer active lists. Keeps touch targets; hides nothing critical.</Text>
          </View>
          <TouchableOpacity style={[styles.toggleButton, { borderColor: theme.border }, settings.compactMode && styles.toggleButtonActive]} onPress={() => onSaveCompactMode(!settings.compactMode)}>
            <Text style={{ color: settings.compactMode ? '#ffffff' : theme.text, fontWeight: '900' }}>{settings.compactMode ? 'On' : 'Off'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.settingsCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <View style={styles.settingsRowBetween}>
          <View style={styles.settingsRowText}>
            <Text style={[styles.label, { color: theme.text }]}>Haptic feedback</Text>
            <Text style={[styles.helpText, { color: theme.muted }]}>Light tactile confirmation for add, bump, chase, status, undo. Best-effort only; not a safety alert.</Text>
          </View>
          <TouchableOpacity style={[styles.toggleButton, { borderColor: theme.border }, settings.hapticsEnabled && styles.toggleButtonActive]} onPress={() => onSaveHapticsEnabled(!settings.hapticsEnabled)}>
            <Text style={{ color: settings.hapticsEnabled ? '#ffffff' : theme.text, fontWeight: '900' }}>{settings.hapticsEnabled ? 'On' : 'Off'}</Text>
          </TouchableOpacity>
        </View>
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
        <Text style={[styles.label, { color: theme.text }]}>Job note shortcuts</Text>
        <TextInput
          value={noteShortcutsText}
          onChangeText={setNoteShortcutsText}
          onBlur={() => onSaveNoteShortcuts(noteShortcutsText)}
          placeholder="M, F, Hb, WCC, CRP, Na, K, Cr"
          placeholderTextColor={theme.placeholder}
          multiline
          style={[styles.input, styles.multiLineInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
        />
        <Text style={[styles.helpText, { color: theme.muted }]}>Comma- or line-separated plain text snippets. The first 8 are radial favourites shown on long-press; keep extras lower in the list as a library/candidates. No interpretation or clinical logic.</Text>
      </View>

      <View style={[styles.settingsCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <Text style={[styles.label, { color: theme.text }]}>Waiting/status phrase shortcuts</Text>
        <TextInput
          value={statusPhraseText}
          onChangeText={setStatusPhraseText}
          onBlur={() => onSaveStatusPhraseShortcuts(statusPhraseText)}
          placeholder="awaiting bloods, awaiting CT, reg aware"
          placeholderTextColor={theme.placeholder}
          multiline
          style={[styles.input, styles.multiLineInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
        />
        <Text style={[styles.helpText, { color: theme.muted }]}>Plain local status phrases for the Waiting for field. They insert text only; they are not reminders, escalation rules, or advice.</Text>
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


export { JobsScreen, HandoverScreen, SettingsScreen, JobFormModal, UndoBar };
