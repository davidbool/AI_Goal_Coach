import { Text, TextInput, View } from "react-native";

import { LEVEL_OPTIONS } from "../constants.js";
import {
  ActionButton,
  ChoicePill,
  HeroBadge,
  HeroPanel,
  StepRail
} from "../components/Primitives.js";
import { styles } from "../../../ui/styles.js";

export function AssessmentScreen({ composer, isBusy, onBuildPlan, onCancel, onChangeAssessment }) {
  return (
    <>
      <HeroPanel
        eyebrow="Goal setup"
        title="Set a pace that fits real life."
        copy="This step keeps the plan grounded in the time and energy you can actually protect each week."
      >
        <View style={styles.heroStatRow}>
          <HeroBadge label="Goal" value="Specific" />
          <HeroBadge label="Next" value="Plan build" />
        </View>
      </HeroPanel>

      <View style={styles.card}>
        <StepRail currentStep={3} />
        <Text style={styles.sectionTitle}>Assessment</Text>
        <Text style={styles.mutedCopy}>
          We use this to estimate the timeline, define milestones, and keep the first week realistic.
        </Text>

        <Text style={styles.fieldLabel}>Current level</Text>
        <View style={styles.pillWrap}>
          {LEVEL_OPTIONS.map((option) => (
            <ChoicePill
              key={option.id}
              active={composer.assessment.currentLevel === option.id}
              disabled={isBusy}
              label={option.label}
              onPress={() => onChangeAssessment("currentLevel", option.id)}
            />
          ))}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Weekly minutes you can realistically protect</Text>
          <TextInput
            keyboardType="number-pad"
            onChangeText={(value) => onChangeAssessment("weeklyMinutesAvailable", value)}
            placeholder="180"
            placeholderTextColor="#8A95A7"
            style={styles.input}
            value={composer.assessment.weeklyMinutesAvailable}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Target date</Text>
          <TextInput
            autoCapitalize="none"
            onChangeText={(value) => onChangeAssessment("targetDate", value)}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#8A95A7"
            style={styles.input}
            value={composer.assessment.targetDate}
          />
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Why this matters</Text>
          <Text style={styles.noteCopy}>
            The coach can always adjust later. Right now we only need an honest starting point that feels sustainable.
          </Text>
        </View>

        <ActionButton
          disabled={isBusy}
          label="Build my plan"
          onPress={onBuildPlan}
          tone="primary"
        />
        <ActionButton disabled={isBusy} label="Pause draft" onPress={onCancel} tone="ghost" />
      </View>
    </>
  );
}
