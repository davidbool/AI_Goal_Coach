import { Text, TextInput, View } from "react-native";

import { ActionButton, HeroBadge, HeroPanel, StepRail } from "../components/Primitives.js";
import { styles } from "../../../ui/styles.js";

export function ClarificationScreen({ composer, isBusy, onCancel, onChangeAnswer, onSubmit }) {
  return (
    <>
      <HeroPanel
        eyebrow="Step 2"
        title="Let's make the goal concrete."
        copy="We do not want a fake-precise plan. These short prompts make sure the app understands what success actually looks like."
      >
        <View style={styles.heroStatRow}>
          <HeroBadge label="Goal" value="Clarify" />
          <HeroBadge
            label="Score"
            value={composer.specificity ? `${Math.round(composer.specificity.score * 100)}%` : "Draft"}
          />
        </View>
      </HeroPanel>

      <View style={styles.card}>
        <StepRail currentStep={2} />
        <Text style={styles.sectionTitle}>{composer.title}</Text>
        <Text style={styles.mutedCopy}>
          Answer in your own words. Short, honest answers are better than aspirational ones.
        </Text>
        {composer.clarificationFields.map((field, index) => (
          <View key={field.id} style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Prompt {index + 1}</Text>
            <Text style={styles.promptText}>{field.questionText}</Text>
            <TextInput
              autoCapitalize="sentences"
              multiline
              onChangeText={(value) => onChangeAnswer(field.id, value)}
              placeholder="Write your answer here"
              placeholderTextColor="#8B7E73"
              style={[styles.input, styles.multilineInput]}
              textAlignVertical="top"
              value={field.answerText}
            />
          </View>
        ))}
        <ActionButton disabled={isBusy} label="Continue" onPress={onSubmit} tone="primary" />
        <ActionButton disabled={isBusy} label="Pause this draft" onPress={onCancel} tone="ghost" />
      </View>
    </>
  );
}
