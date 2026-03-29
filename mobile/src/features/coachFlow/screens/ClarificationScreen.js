import { Text, TextInput, View } from "react-native";

import {
  ActionButton,
  ChatBubble,
  HeroBadge,
  HeroPanel,
  StepRail
} from "../components/Primitives.js";
import { styles } from "../../../ui/styles.js";

export function ClarificationScreen({ composer, isBusy, onCancel, onChangeAnswer, onSubmit }) {
  return (
    <>
      <HeroPanel
        eyebrow="Onboarding chat"
        title="A few details will make this plan stronger."
        copy="Short, honest answers are enough. The goal is clarity, not perfection."
      >
        <View style={styles.heroStatRow}>
          <HeroBadge label="Goal" value="Clarify" />
          <HeroBadge
            label="Specificity"
            value={composer.specificity ? `${Math.round(composer.specificity.score * 100)}%` : "Draft"}
          />
        </View>
      </HeroPanel>

      <View style={styles.card}>
        <StepRail currentStep={2} />
        <Text style={styles.sectionTitle}>{composer.title}</Text>
        <View style={styles.chatThread}>
          <ChatBubble text="I'm close to having enough context. Answer these and I'll shape the plan around your real situation." />
          {composer.clarificationFields.map((field, index) => (
            <View key={field.id} style={styles.chatQuestionBlock}>
              <Text style={styles.fieldLabel}>Prompt {index + 1}</Text>
              <ChatBubble text={field.questionText} />
              <TextInput
                autoCapitalize="sentences"
                multiline
                onChangeText={(value) => onChangeAnswer(field.id, value)}
                placeholder="Type your answer"
                placeholderTextColor="#8A95A7"
                style={[styles.input, styles.chatReplyInput, styles.multilineInput]}
                textAlignVertical="top"
                value={field.answerText}
              />
            </View>
          ))}
        </View>
        <ActionButton disabled={isBusy} label="Continue" onPress={onSubmit} tone="primary" />
        <ActionButton disabled={isBusy} label="Pause draft" onPress={onCancel} tone="ghost" />
      </View>
    </>
  );
}
