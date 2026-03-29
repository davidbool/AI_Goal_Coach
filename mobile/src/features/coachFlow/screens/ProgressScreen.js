import { Text, TextInput, View } from "react-native";

import {
  createGoalSummary,
  formatPercent,
  isGoalActivatable
} from "../model.js";
import {
  ActionButton,
  ChoicePill,
  GoalRow,
  MilestoneRow,
  ProgressBar,
  SegmentedControl
} from "../components/Primitives.js";
import { styles } from "../../../ui/styles.js";

export function ProgressScreen({
  activeGoal,
  goals,
  isBusy,
  notificationDirty,
  notificationDraft,
  notifications,
  progress,
  pushStatusMessage,
  today,
  onAdaptUpcomingDays,
  onChangeNotificationField,
  onConfirmMilestone,
  onCreateAnotherGoal,
  onRegisterPushToken,
  onSaveNotifications,
  onSelectNotificationMaxPush,
  onShowToday,
  onSwitchGoal
}) {
  const otherGoals = goals.filter((goal) => goal.id !== activeGoal?.id);
  const adherenceRate = progress?.adherence?.completion_rate_7d ?? progress?.adherence_7d ?? 0;
  const feedback =
    today?.feedback ?? "You are building momentum by showing up consistently instead of overloading the plan.";
  const tokenStatusCopy =
    pushStatusMessage ||
    (notifications?.hasPushToken
      ? "Push is already configured for this account."
      : "No push token is registered yet. Reminder settings will still sync with the backend.");

  return (
    <>
      <View style={styles.greetingWrap}>
        <Text style={styles.pageEyebrow}>Progress</Text>
        <Text style={styles.pageTitle}>Your momentum</Text>
        <Text style={styles.pageSubtitle}>
          Keep the feedback calm, visible, and easy to act on.
        </Text>
      </View>

      <SegmentedControl
        options={[
          { label: "Today", value: "today" },
          { label: "Progress", value: "progress" }
        ]}
        value="progress"
        onChange={(nextValue) => {
          if (nextValue === "today") {
            onShowToday();
          }
        }}
      />

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Weekly progress</Text>
        <View style={styles.progressSummaryRow}>
          <View style={styles.progressStat}>
            <Text style={styles.progressStatLabel}>Streak</Text>
            <Text style={styles.progressStatValue}>{progress?.streak?.current_days ?? 0}</Text>
          </View>
          <View style={styles.progressStat}>
            <Text style={styles.progressStatLabel}>Weekly rate</Text>
            <Text style={styles.progressStatValue}>{formatPercent(adherenceRate)}</Text>
          </View>
        </View>
        <ProgressBar progress={adherenceRate} />
        <Text style={styles.mutedCopy}>
          {activeGoal?.title ?? "Your active goal"} is tracking at {formatPercent(adherenceRate)} completion over the last 7 days.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>AI feedback</Text>
        <Text style={styles.noteCopy}>{feedback}</Text>
        <ActionButton
          disabled={isBusy}
          label="Adapt upcoming days"
          onPress={onAdaptUpcomingDays}
          tone="secondary"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Milestones</Text>
        {!progress || !progress.milestones || progress.milestones.length === 0 ? (
          <Text style={styles.emptyLine}>Milestones will appear here once your plan is active.</Text>
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
        <Text style={styles.sectionTitle}>Reminders</Text>
        <Text style={styles.mutedCopy}>
          Keep notifications supportive and low-noise.
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
            placeholderTextColor="#8A95A7"
            style={styles.input}
            value={notificationDraft.reminderTimeLocal}
          />
        </View>

        <View style={styles.formSplitRow}>
          <View style={styles.formSplitItem}>
            <Text style={styles.fieldLabel}>Quiet start</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              onChangeText={(value) => onChangeNotificationField("quietHoursStart", value)}
              placeholder="22:00"
              placeholderTextColor="#8A95A7"
              style={styles.input}
              value={notificationDraft.quietHoursStart}
            />
          </View>
          <View style={styles.formSplitItem}>
            <Text style={styles.fieldLabel}>Quiet end</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              onChangeText={(value) => onChangeNotificationField("quietHoursEnd", value)}
              placeholder="07:00"
              placeholderTextColor="#8A95A7"
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

        {!notifications?.hasPushToken ? (
          <ActionButton
            disabled={isBusy}
            label="Register this device"
            onPress={onRegisterPushToken}
            tone="secondary"
          />
        ) : null}

        <ActionButton
          disabled={isBusy || !notificationDirty}
          label={notificationDirty ? "Save reminders" : "Reminders up to date"}
          onPress={onSaveNotifications}
          tone={notificationDirty ? "primary" : "muted"}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Goal library</Text>
        <Text style={styles.mutedCopy}>
          Keep one active goal at a time and switch only when you mean it.
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
