import { Text, TextInput, View } from "react-native";

import { GOAL_PROMPTS } from "../constants.js";
import {
  createGoalSummary,
  getGoalStudioPresentation,
  isGoalActivatable
} from "../model.js";
import {
  ActionButton,
  ChatBubble,
  ChoicePill,
  GoalRow,
  HeroBadge,
  HeroPanel,
  StepRail
} from "../components/Primitives.js";
import { styles } from "../../../ui/styles.js";

export function GoalStudioScreen({
  composer,
  existingGoals,
  hasActiveGoal,
  isBusy,
  onActivateGoal,
  onCancel,
  onChangeGoalTitle,
  onCreateGoal,
  onSelectGoalPrompt
}) {
  const canClose = composer.stage === "intake" || hasActiveGoal;
  const presentation = getGoalStudioPresentation(hasActiveGoal);

  return (
    <>
      <HeroPanel
        eyebrow="Onboarding chat"
        title="Let's define the goal first."
        copy="A calm plan starts with a clear target. Keep it concrete, realistic, and human."
      >
        <View style={styles.heroStatRow}>
          <HeroBadge label="Flow" value="AI onboarding" />
          <HeroBadge label="Style" value="Minimal chat" />
        </View>
      </HeroPanel>

      <View style={styles.card}>
        <StepRail currentStep={1} />
        <View style={styles.chatThread}>
          <ChatBubble text={presentation.heroCopy} />
          <ChatBubble text="What goal would you like me to help you work toward?" />
          {composer.title.trim() ? <ChatBubble role="user" text={composer.title.trim()} /> : null}
        </View>

        <View style={styles.chatComposer}>
          <TextInput
            autoCapitalize="sentences"
            multiline
            onChangeText={onChangeGoalTitle}
            placeholder="Write one goal with an outcome and timeframe"
            placeholderTextColor="#8A95A7"
            style={[styles.chatInput, styles.multilineInput]}
            textAlignVertical="top"
            value={composer.title}
          />
          <Text style={styles.fieldLabel}>Starter prompts</Text>
          <View style={styles.pillWrap}>
            {GOAL_PROMPTS.map((prompt) => (
              <ChoicePill
                key={prompt}
                active={composer.title === prompt}
                disabled={isBusy}
                label={prompt}
                onPress={() => onSelectGoalPrompt(prompt)}
              />
            ))}
          </View>
          <ActionButton
            disabled={isBusy}
            label="Continue"
            onPress={onCreateGoal}
            tone="primary"
          />
          {canClose ? (
            <ActionButton
              disabled={isBusy}
              label="Not now"
              onPress={onCancel}
              tone="ghost"
            />
          ) : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Saved goals</Text>
        <Text style={styles.mutedCopy}>{presentation.libraryCopy}</Text>
        {existingGoals.length === 0 ? (
          <Text style={styles.emptyLine}>{presentation.emptyLibraryCopy}</Text>
        ) : (
          existingGoals.map((goal) => (
            <GoalRow
              key={goal.id}
              actionLabel={isGoalActivatable(goal) ? "Activate" : "Reuse"}
              onPress={() =>
                isGoalActivatable(goal) ? onActivateGoal(goal.id) : onSelectGoalPrompt(goal.title)
              }
              summary={createGoalSummary(goal)}
              title={goal.title}
            />
          ))
        )}
      </View>
    </>
  );
}
