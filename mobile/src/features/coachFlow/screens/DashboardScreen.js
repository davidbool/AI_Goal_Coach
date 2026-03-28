import { Text, TextInput, View } from "react-native";

import {
  createGoalSummary,
  formatPercent,
  getDashboardPresentation,
  isGoalActivatable
} from "../model.js";
import {
  ActionButton,
  ChoicePill,
  GoalRow,
  HeroBadge,
  HeroPanel,
  MetricTile,
  MilestoneRow,
  TaskCard
} from "../components/Primitives.js";
import { styles } from "../../../ui/styles.js";

export function DashboardScreen({
  activeGoal,
  goals,
  isBusy,
  localDateKey,
  notificationDirty,
  notificationDraft,
  notifications,
  progress,
  today,
  onChangeNotificationField,
  onCompleteTask,
  onConfirmMilestone,
  onCreateAnotherGoal,
  onRefresh,
  onSaveNotifications,
  onSelectNotificationMaxPush,
  onSkipTask,
  onSoftAdjust,
  onSwitchGoal
}) {
  const otherGoals = goals.filter((goal) => goal.id !== activeGoal?.id);
  const adherenceRate = progress?.adherence?.completion_rate_7d ?? progress?.adherence_7d ?? 0;
  const adherenceWidth = `${Math.max(8, Math.round(adherenceRate * 100))}%`;
  const presentation = getDashboardPresentation({ localDateKey, today });
  const tokenStatusCopy = notifications?.hasPushToken
    ? "A push token is already registered for this account. Delivery setup stays out of scope in this slice."
    : "No push token is registered yet. This dashboard only shows status, so token setup can wait.";

  return (
    <>
      <HeroPanel
        eyebrow="Today"
        title={activeGoal?.title ?? "Your active goal"}
        copy={presentation.heroCopy}
      >
        <View style={styles.heroStatRow}>
          <HeroBadge label="Streak" value={String(progress?.streak?.current_days ?? 0)} />
          <HeroBadge label="Adherence" value={formatPercent(adherenceRate)} />
          <HeroBadge label="Plan" value={`v${progress?.plan_version ?? 1}`} />
        </View>
      </HeroPanel>

      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Today's focus</Text>
          <ActionButton
            disabled={isBusy}
            label={presentation.refreshLabel}
            onPress={onRefresh}
            tone="secondary"
            compact
          />
        </View>
        {today?.feedback ? (
          <View style={styles.noteCard}>
            <Text style={styles.noteCopy}>{today.feedback}</Text>
          </View>
        ) : null}
        {!today ? (
          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>{presentation.emptyTitle}</Text>
            <Text style={styles.noteCopy}>{presentation.emptyCopy}</Text>
          </View>
        ) : today.tasks.length === 0 ? (
          <>
            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>{presentation.emptyTitle}</Text>
              <Text style={styles.noteCopy}>{presentation.emptyCopy}</Text>
            </View>
            <View style={styles.inlineActionRow}>
              <View style={styles.inlineActionItem}>
                <ActionButton
                  disabled={isBusy}
                  label={presentation.refreshLabel}
                  onPress={onRefresh}
                  tone="secondary"
                />
              </View>
              <View style={styles.inlineActionItem}>
                <ActionButton
                  disabled={isBusy}
                  label="Lighten today anyway"
                  onPress={onSoftAdjust}
                  tone="ghost"
                />
              </View>
            </View>
          </>
        ) : (
          <>
            {today.tasks.map((task) => (
              <TaskCard
                key={task.id}
                disabled={isBusy}
                onComplete={() => onCompleteTask(task.id, task.title)}
                onSkip={() => onSkipTask(task.id)}
                task={task}
              />
            ))}
            <ActionButton disabled={isBusy} label="Lighten today" onPress={onSoftAdjust} tone="secondary" />
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Reminders</Text>
        <Text style={styles.mutedCopy}>
          Edit the effective reminder schedule here. Saving patches preferences and then refreshes bootstrap so the dashboard stays aligned with the server.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Reminder time</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            onChangeText={(value) => onChangeNotificationField("reminderTimeLocal", value)}
            placeholder="20:00"
            placeholderTextColor="#8B7E73"
            style={styles.input}
            value={notificationDraft.reminderTimeLocal}
          />
        </View>

        <View style={styles.formSplitRow}>
          <View style={styles.formSplitItem}>
            <Text style={styles.fieldLabel}>Quiet hours start</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              onChangeText={(value) => onChangeNotificationField("quietHoursStart", value)}
              placeholder="22:00"
              placeholderTextColor="#8B7E73"
              style={styles.input}
              value={notificationDraft.quietHoursStart}
            />
          </View>
          <View style={styles.formSplitItem}>
            <Text style={styles.fieldLabel}>Quiet hours end</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              onChangeText={(value) => onChangeNotificationField("quietHoursEnd", value)}
              placeholder="07:00"
              placeholderTextColor="#8B7E73"
              style={styles.input}
              value={notificationDraft.quietHoursEnd}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Max push per day</Text>
          <View style={styles.pillWrap}>
            {[1, 2].map((option) => (
              <ChoicePill
                key={option}
                active={notificationDraft.maxPushPerDay === option}
                disabled={isBusy}
                label={`${option} / day`}
                onPress={() => onSelectNotificationMaxPush(option)}
              />
            ))}
          </View>
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Push status</Text>
          <Text style={styles.noteCopy}>{tokenStatusCopy}</Text>
        </View>

        {notificationDirty ? (
          <Text style={styles.helperLine}>
            Unsaved reminder edits stay in place while the rest of the dashboard refreshes.
          </Text>
        ) : null}

        <ActionButton
          disabled={isBusy || !notificationDirty}
          label={notificationDirty ? "Save reminders" : "Reminders up to date"}
          onPress={onSaveNotifications}
          tone={notificationDirty ? "primary" : "muted"}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Momentum</Text>
        <View style={styles.metricGrid}>
          <MetricTile label="7-day adherence" value={formatPercent(adherenceRate)} />
          <MetricTile label="Longest streak" value={String(progress?.streak?.longest_days ?? 0)} />
          <MetricTile label="Milestones done" value={String(progress?.milestones_done ?? 0)} />
          <MetricTile label="Last success" value={progress?.streak?.last_success_date ?? "None yet"} />
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: adherenceWidth }]} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Milestones</Text>
        {!progress || progress.milestones.length === 0 ? (
          <Text style={styles.emptyLine}>Milestones will appear here once a generated plan is active.</Text>
        ) : (
          progress.milestones.map((milestone) => (
            <MilestoneRow
              key={milestone.id}
              disabled={isBusy}
              milestone={milestone}
              onConfirm={() => onConfirmMilestone(milestone.id, milestone.title)}
            />
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Goal library</Text>
        <Text style={styles.mutedCopy}>
          Only one goal can be active in the MVP. Switching focus automatically pauses the previous active goal.
        </Text>
        <ActionButton
          disabled={isBusy}
          label="Create another goal"
          onPress={onCreateAnotherGoal}
          tone="primary"
        />
        {otherGoals.length === 0 ? (
          <Text style={styles.emptyLine}>No other saved goals yet.</Text>
        ) : (
          otherGoals.map((goal) => (
            <GoalRow
              key={goal.id}
              actionLabel={isGoalActivatable(goal) ? "Switch focus" : "Unavailable"}
              disabled={!isGoalActivatable(goal) || isBusy}
              onPress={() => onSwitchGoal(goal.id)}
              summary={createGoalSummary(goal)}
              title={goal.title}
            />
          ))
        )}
      </View>
    </>
  );
}
