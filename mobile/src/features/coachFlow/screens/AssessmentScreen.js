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
        eyebrow="Step 3"
        title="Calibrate the pace to your real life."
        copy="This is where the app stops pretending your ideal week is your actual week. Set a pace you can sustain."
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
          We use this to set milestones, estimate the timeline, and shape your first tasks.
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
            placeholderTextColor="#8B7E73"
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
            placeholderTextColor="#8B7E73"
            style={styles.input}
            value={composer.assessment.targetDate}
          />
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Good to know</Text>
          <Text style={styles.noteCopy}>
            The coach can soften today or adapt a future plan later. Right now we only need an honest starting point.
          </Text>
        </View>

        <ActionButton
          disabled={isBusy}
          label="Build my first plan"
          onPress={onBuildPlan}
          tone="primary"
        />
        <ActionButton disabled={isBusy} label="Pause this draft" onPress={onCancel} tone="ghost" />
      </View>
    </>
  );
}
