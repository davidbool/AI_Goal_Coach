import { Text, TextInput, View } from "react-native";

import { GOAL_PROMPTS } from "../constants.js";
import {
  createGoalSummary,
  getGoalStudioPresentation,
  isGoalActivatable
} from "../model.js";
import {
  ActionButton,
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
        eyebrow="Step 1"
        title="Name a goal worth showing up for."
        copy={presentation.heroCopy}
      >
        <View style={styles.heroStatRow}>
          <HeroBadge label="Flow" value="Intake" />
          <HeroBadge label="Style" value="Supportive" />
        </View>
      </HeroPanel>

      <View style={styles.card}>
        <StepRail currentStep={1} />
        <Text style={styles.sectionTitle}>Start with one sentence</Text>
        <Text style={styles.mutedCopy}>
          A good goal is specific enough to plan, but still human. We will help you tighten it if it is too broad.
        </Text>
        <TextInput
          autoCapitalize="sentences"
          multiline
          onChangeText={onChangeGoalTitle}
          placeholder="Example: Learn React by building 2 projects by 2026-10-01"
          placeholderTextColor="#8B7E73"
          style={[styles.input, styles.multilineInput]}
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
          label="Shape this goal"
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

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Goal library</Text>
        <Text style={styles.mutedCopy}>{presentation.libraryCopy}</Text>
        {existingGoals.length === 0 ? (
          <Text style={styles.emptyLine}>{presentation.emptyLibraryCopy}</Text>
        ) : (
          existingGoals.map((goal) => (
            <GoalRow
              key={goal.id}
              actionLabel={isGoalActivatable(goal) ? "Activate" : "Reuse wording"}
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
