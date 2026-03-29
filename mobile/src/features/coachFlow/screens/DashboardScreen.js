import { Text, View } from "react-native";

import { getTaskMinutes, humanizeToken } from "../model.js";
import {
  ActionButton,
  ProgressBar,
  SegmentedControl,
  TaskCard,
  TaskItem
} from "../components/Primitives.js";
import { styles } from "../../../ui/styles.js";

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function buildTaskMeta(task) {
  return `${getTaskMinutes(task)} min · ${humanizeToken(task.difficulty)} · ${
    task.required ? "Required" : "Flexible"
  }`;
}

export function DashboardScreen({
  activeGoal,
  editingTaskId,
  isBusy,
  progress,
  taskEditDraft,
  today,
  onBeginTaskEdit,
  onCancelTaskEdit,
  onChangeTaskEditField,
  onCompleteTask,
  onCompleteToday,
  onRefresh,
  onSaveTaskEdit,
  onShowProgress,
  onSkipTask,
  onSoftAdjust
}) {
  const tasks = today?.tasks ?? [];
  const resolvedCount = tasks.filter(
    (task) => task.state === "completed" || task.state === "skipped"
  ).length;
  const pendingCount = tasks.filter((task) => task.state === "pending").length;
  const completionRate = tasks.length ? resolvedCount / tasks.length : 0;
  const feedbackMessage =
    today?.feedback ?? "Steady, low-friction progress beats an ambitious plan you cannot repeat.";

  return (
    <>
      <View style={styles.greetingWrap}>
        <Text style={styles.pageEyebrow}>Today</Text>
        <Text style={styles.pageTitle}>{`${getGreeting()}, David`}</Text>
        <Text style={styles.pageSubtitle}>
          Focus on the next few steps, not the whole mountain.
        </Text>
      </View>

      <SegmentedControl
        options={[
          { label: "Today", value: "today" },
          { label: "Progress", value: "progress" }
        ]}
        value="today"
        onChange={(nextValue) => {
          if (nextValue === "progress") {
            onShowProgress();
          }
        }}
      />

      <View style={styles.card}>
        <View style={styles.goalCardHeader}>
          <View style={styles.listRowCopy}>
            <Text style={styles.goalCardTitle}>{activeGoal?.title ?? "Your active goal"}</Text>
            <Text style={styles.goalCardMeta}>
              {tasks.length > 0
                ? `${resolvedCount} of ${tasks.length} tasks done today`
                : "Your daily plan will appear here once today is ready."}
            </Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statPillText}>
              {`Streak ${progress?.streak?.current_days ?? 0}`}
            </Text>
          </View>
        </View>
        <ProgressBar progress={completionRate} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Today's tasks</Text>
        {tasks.length === 0 ? (
          <>
            <Text style={styles.emptyLine}>
              Today is intentionally light. You can refresh or adjust the plan if you want a new snapshot.
            </Text>
            <View style={styles.inlineActionRow}>
              <View style={styles.inlineActionItem}>
                <ActionButton
                  disabled={isBusy}
                  label="Refresh today"
                  onPress={onRefresh}
                  tone="secondary"
                />
              </View>
              <View style={styles.inlineActionItem}>
                <ActionButton
                  disabled={isBusy}
                  label="Lighten today"
                  onPress={onSoftAdjust}
                  tone="ghost"
                />
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.taskList}>
              {tasks.map((task) => {
                if (editingTaskId === task.id) {
                  return (
                    <TaskCard
                      key={task.id}
                      disabled={isBusy}
                      editingDisabled={false}
                      isEditing
                      onCancelEditing={onCancelTaskEdit}
                      onChangeEditField={onChangeTaskEditField}
                      onComplete={() => onCompleteTask(task.id, task.title)}
                      onSaveEditing={() => onSaveTaskEdit(task.id)}
                      onSkip={() => onSkipTask(task.id)}
                      onStartEditing={() => onBeginTaskEdit(task)}
                      task={task}
                      taskEditDraft={taskEditDraft}
                    />
                  );
                }

                return (
                  <TaskItem
                    key={task.id}
                    disabled={isBusy || (Boolean(editingTaskId) && editingTaskId !== task.id)}
                    isDone={task.state === "completed" || task.state === "skipped"}
                    meta={buildTaskMeta(task)}
                    onEdit={() => onBeginTaskEdit(task)}
                    onSkip={() => onSkipTask(task.id)}
                    onToggle={() => onCompleteTask(task.id, task.title)}
                    title={task.title}
                  />
                );
              })}
            </View>

            <ActionButton
              disabled={isBusy || pendingCount === 0}
              label="Complete today"
              onPress={onCompleteToday}
              tone="primary"
            />
            <View style={styles.inlineActionRow}>
              <View style={styles.inlineActionItem}>
                <ActionButton
                  disabled={isBusy}
                  label="Lighten today"
                  onPress={onSoftAdjust}
                  tone="secondary"
                />
              </View>
              <View style={styles.inlineActionItem}>
                <ActionButton
                  disabled={isBusy}
                  label="Refresh"
                  onPress={onRefresh}
                  tone="ghost"
                />
              </View>
            </View>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>AI note</Text>
        <Text style={styles.noteCopy}>{feedbackMessage}</Text>
      </View>
    </>
  );
}
