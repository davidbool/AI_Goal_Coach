import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";

import {
  getTaskMinutes,
  getTaskPreservationIndicator,
  humanizeToken,
  TASK_DIFFICULTY_OPTIONS
} from "../model.js";
import {
  styles,
  toneButtonStyles,
  toneButtonTextStyles,
  toneStyles,
  toneTextStyles
} from "../../../ui/styles.js";

export function SessionScroll({ busyLabel, coachMessage, errorMessage, children }) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {coachMessage ? <CoachBanner message={coachMessage} /> : null}
        {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
        {children}
        {busyLabel ? <BusyNotice label={busyLabel} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function LoadingScreen({ copy, title }) {
  return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator size="large" color="#5B7CFA" />
      <Text style={styles.loadingTitle}>{title}</Text>
      <Text style={styles.loadingCopy}>{copy}</Text>
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function HeroPanel({ eyebrow, title, copy, children }) {
  return (
    <View style={styles.heroCard}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.heroTitle}>{title}</Text>
      {copy ? <Text style={styles.heroCopy}>{copy}</Text> : null}
      {children}
    </View>
  );
}

export function StepRail({ currentStep }) {
  return (
    <View style={styles.stepRail}>
      {[1, 2, 3, 4].map((step) => (
        <View key={step} style={styles.stepRailItem}>
          <View
            style={[
              styles.stepRailDot,
              step <= currentStep ? styles.stepRailDotActive : null
            ]}
          >
            <Text
              style={[
                styles.stepRailDotText,
                step <= currentStep ? styles.stepRailDotTextActive : null
              ]}
            >
              {step}
            </Text>
          </View>
          {step < 4 ? (
            <View
              style={[
                styles.stepRailLine,
                step < currentStep ? styles.stepRailLineActive : null
              ]}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function SegmentedControl({ options, value, onChange }) {
  return (
    <View style={styles.segmentedControl}>
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segmentedItem,
              isActive ? styles.segmentedItemActive : null,
              pressed && !isActive ? styles.buttonPressed : null
            ]}
          >
            <Text
              style={[
                styles.segmentedLabel,
                isActive ? styles.segmentedLabelActive : null
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function GoalRow({
  actionLabel,
  compactAction = false,
  disabled = false,
  onPress,
  summary,
  title
}) {
  return (
    <View style={styles.listRow}>
      <View style={styles.listRowCopy}>
        <Text style={styles.listPrimary}>{title}</Text>
        <Text style={styles.listSecondary}>{summary}</Text>
      </View>
      <ActionButton
        compact={compactAction}
        disabled={disabled}
        label={actionLabel}
        onPress={onPress}
        tone={disabled ? "muted" : "secondary"}
      />
    </View>
  );
}

function TextLinkButton({ danger = false, disabled, label, onPress }) {
  return (
    <Pressable disabled={disabled} onPress={onPress}>
      <Text style={[styles.textLink, danger ? styles.textLinkDanger : null]}>{label}</Text>
    </Pressable>
  );
}

export function TaskItem({
  disabled = false,
  isDone = false,
  meta,
  onEdit,
  onSkip,
  onToggle,
  title
}) {
  return (
    <View style={[styles.taskItem, isDone ? styles.taskItemDone : null]}>
      <Pressable
        disabled={disabled || isDone}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.taskCheckbox,
          isDone ? styles.taskCheckboxDone : null,
          pressed && !disabled && !isDone ? styles.buttonPressed : null
        ]}
      >
        <Text
          style={[
            styles.taskCheckboxGlyph,
            isDone ? styles.taskCheckboxGlyphDone : null
          ]}
        >
          ✓
        </Text>
      </Pressable>
      <View style={styles.taskItemContent}>
        <Text style={[styles.taskItemTitle, isDone ? styles.taskItemTitleDone : null]}>{title}</Text>
        {meta ? <Text style={styles.taskItemMeta}>{meta}</Text> : null}
        {!isDone && (onEdit || onSkip) ? (
          <View style={styles.taskItemActionRow}>
            {onEdit ? (
              <TextLinkButton disabled={disabled} label="Edit" onPress={onEdit} />
            ) : null}
            {onSkip ? (
              <TextLinkButton danger disabled={disabled} label="Skip" onPress={onSkip} />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function ProgressBar({ progress }) {
  const safeProgress = Math.max(0, Math.min(1, progress ?? 0));
  const fillWidth = safeProgress === 0 ? "0%" : `${Math.max(6, Math.round(safeProgress * 100))}%`;

  return (
    <View style={styles.progressBarTrack}>
      <View style={[styles.progressBarFill, { width: fillWidth }]} />
    </View>
  );
}

export function ChatBubble({ role = "assistant", text, children }) {
  const isUser = role === "user";

  return (
    <View style={[styles.chatMessageRow, isUser ? styles.chatMessageRowUser : null]}>
      <View
        style={[
          styles.chatBubble,
          isUser ? styles.chatBubbleUser : styles.chatBubbleAssistant
        ]}
      >
        {text ? (
          <Text style={[styles.chatBubbleText, isUser ? styles.chatBubbleTextUser : null]}>
            {text}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

export function TaskCard({
  disabled,
  editingDisabled = false,
  isEditing = false,
  onCancelEditing,
  onChangeEditField,
  onComplete,
  onSaveEditing,
  onSkip,
  onStartEditing,
  task,
  taskEditDraft
}) {
  const state = task.state ?? "pending";
  const isFinished = state === "completed" || state === "skipped";
  const preservationIndicator = getTaskPreservationIndicator(task);
  const actionDisabled = disabled || editingDisabled;
  const draft = taskEditDraft ?? {
    title: "",
    estMinutes: "",
    difficulty: "medium",
    required: true
  };

  return (
    <View style={styles.taskCard}>
      <View style={styles.taskCardHeader}>
        <Text style={styles.taskTitle}>{isEditing ? "Edit task details" : task.title}</Text>
        <View style={styles.taskHeaderChips}>
          {preservationIndicator ? (
            <StatusChip label={preservationIndicator.label} tone={preservationIndicator.tone} />
          ) : null}
          <StatusChip label={humanizeToken(state)} tone={state} />
        </View>
      </View>
      {!isEditing ? (
        <>
          <View style={styles.taskMetaRow}>
            <StatusChip label={`${getTaskMinutes(task)} min`} tone="neutral" />
            <StatusChip label={humanizeToken(task.difficulty)} tone={task.difficulty} />
            <StatusChip
              label={task.required ? "Required" : "Flexible"}
              tone={task.required ? "required" : "neutral"}
            />
          </View>
          {preservationIndicator ? (
            <Text style={styles.helperLine}>{preservationIndicator.copy}</Text>
          ) : null}
          {!isFinished ? (
            <View style={styles.taskActionStack}>
              <View style={styles.inlineActionRow}>
                <View style={styles.inlineActionItem}>
                  <ActionButton
                    disabled={actionDisabled}
                    label="Complete"
                    onPress={onComplete}
                    tone="primary"
                  />
                </View>
                <View style={styles.inlineActionItem}>
                  <ActionButton
                    disabled={actionDisabled}
                    label="Skip"
                    onPress={onSkip}
                    tone="ghost"
                  />
                </View>
              </View>
              <ActionButton
                compact
                disabled={actionDisabled}
                label={task.manual_lock ? "Edit again" : "Edit details"}
                onPress={onStartEditing}
                tone="secondary"
              />
            </View>
          ) : null}
        </>
      ) : (
        <>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              editable={!disabled}
              onChangeText={(value) => onChangeEditField("title", value)}
              placeholder="Task title"
              placeholderTextColor="#8A95A7"
              style={styles.input}
              value={draft.title}
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Duration (minutes)</Text>
            <TextInput
              editable={!disabled}
              keyboardType="number-pad"
              onChangeText={(value) => onChangeEditField("estMinutes", value)}
              placeholder="25"
              placeholderTextColor="#8A95A7"
              style={styles.input}
              value={draft.estMinutes}
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Difficulty</Text>
            <View style={styles.pillWrap}>
              {TASK_DIFFICULTY_OPTIONS.map((option) => (
                <ChoicePill
                  key={option}
                  active={draft.difficulty === option}
                  disabled={disabled}
                  label={humanizeToken(option)}
                  onPress={() => onChangeEditField("difficulty", option)}
                />
              ))}
            </View>
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Required</Text>
            <View style={styles.pillWrap}>
              <ChoicePill
                active={draft.required}
                disabled={disabled}
                label="Required"
                onPress={() => onChangeEditField("required", true)}
              />
              <ChoicePill
                active={!draft.required}
                disabled={disabled}
                label="Flexible"
                onPress={() => onChangeEditField("required", false)}
              />
            </View>
          </View>
          <Text style={styles.helperLine}>
            Saving manual edits keeps this task stable during future plan updates.
          </Text>
          <View style={styles.inlineActionRow}>
            <View style={styles.inlineActionItem}>
              <ActionButton
                disabled={disabled}
                label="Save changes"
                onPress={onSaveEditing}
                tone="primary"
              />
            </View>
            <View style={styles.inlineActionItem}>
              <ActionButton
                disabled={disabled}
                label="Cancel"
                onPress={onCancelEditing}
                tone="ghost"
              />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

export function MilestoneRow({ disabled, milestone, onConfirm }) {
  const isPending = milestone.status === "pending";

  return (
    <View style={styles.listRow}>
      <View style={styles.listRowCopy}>
        <Text style={styles.listPrimary}>{milestone.title}</Text>
        <Text style={styles.listSecondary}>
          Week {milestone.target_week} · {humanizeToken(milestone.status)}
        </Text>
        <Text style={styles.listTertiary}>{milestone.success_criteria}</Text>
      </View>
      <ActionButton
        compact
        disabled={disabled || !isPending}
        label={isPending ? "Confirm" : "Done"}
        onPress={onConfirm}
        tone={isPending ? "secondary" : "muted"}
      />
    </View>
  );
}

export function MilestonePreviewRow({ milestone }) {
  return (
    <View style={styles.previewRow}>
      <View style={styles.previewWeekBadge}>
        <Text style={styles.previewWeekText}>W{milestone.target_week}</Text>
      </View>
      <View style={styles.previewCopy}>
        <Text style={styles.listPrimary}>{milestone.title}</Text>
        <Text style={styles.listTertiary}>{milestone.success_criteria}</Text>
      </View>
    </View>
  );
}

export function TaskPreviewRow({ task }) {
  return (
    <View style={styles.previewRow}>
      <View style={styles.previewWeekBadge}>
        <Text style={styles.previewWeekText}>{getTaskMinutes(task)}m</Text>
      </View>
      <View style={styles.previewCopy}>
        <Text style={styles.listPrimary}>{task.title}</Text>
        <Text style={styles.listTertiary}>
          {humanizeToken(task.difficulty)} · {task.required ? "Required" : "Flexible"}
        </Text>
      </View>
    </View>
  );
}

export function HeroBadge({ label, value }) {
  return (
    <View style={styles.heroBadge}>
      <Text style={styles.heroBadgeLabel}>{label}</Text>
      <Text style={styles.heroBadgeValue}>{value}</Text>
    </View>
  );
}

export function MetricTile({ label, value }) {
  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricTileLabel}>{label}</Text>
      <Text style={styles.metricTileValue}>{value}</Text>
    </View>
  );
}

export function StatusChip({ label, tone }) {
  return (
    <View style={[styles.statusChip, toneStyles[tone] ?? toneStyles.neutral]}>
      <Text style={[styles.statusChipText, toneTextStyles[tone] ?? toneTextStyles.neutral]}>
        {label}
      </Text>
    </View>
  );
}

export function ActionButton({ compact = false, disabled = false, label, onPress, tone }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonBase,
        toneButtonStyles[tone] ?? toneButtonStyles.secondary,
        compact ? styles.buttonCompact : null,
        disabled ? styles.buttonDisabled : null,
        pressed && !disabled ? styles.buttonPressed : null
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          toneButtonTextStyles[tone] ?? toneButtonTextStyles.secondary,
          disabled ? styles.buttonTextDisabled : null
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ChoicePill({ active, disabled = false, label, onPress }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choicePill,
        active ? styles.choicePillActive : null,
        disabled ? styles.choicePillDisabled : null,
        pressed && !disabled ? styles.buttonPressed : null
      ]}
    >
      <Text style={[styles.choicePillText, active ? styles.choicePillTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function CoachBanner({ message }) {
  return (
    <View style={styles.coachBanner}>
      <Text style={styles.coachBannerText}>{message}</Text>
    </View>
  );
}

export function ErrorBanner({ message }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function BusyNotice({ label }) {
  return (
    <View style={styles.busyFooter}>
      <ActivityIndicator size="small" color="#5B7CFA" />
      <Text style={styles.busyText}>{label}</Text>
    </View>
  );
}

export function BackgroundArt() {
  return (
    <View pointerEvents="none" style={styles.backgroundWrap}>
      <View style={styles.backgroundBlobTop} />
      <View style={styles.backgroundBlobLeft} />
      <View style={styles.backgroundBlobBottom} />
      <View style={styles.backgroundHalo} />
    </View>
  );
}
