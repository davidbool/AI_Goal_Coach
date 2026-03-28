import { Text, View } from "react-native";

import { getGenerationStateContent, humanizeToken } from "../model.js";
import {
  ActionButton,
  HeroBadge,
  HeroPanel,
  StatusChip,
  StepRail
} from "../components/Primitives.js";
import { styles } from "../../../ui/styles.js";

export function GenerationFailedScreen({ composer, isBusy, onBack, onRetry }) {
  const presentation = getGenerationStateContent("failed");

  return (
    <>
      <HeroPanel
        eyebrow="Plan failed"
        title={presentation.title}
        copy={presentation.heroCopy}
      >
        <View style={styles.heroStatRow}>
          <HeroBadge label="Goal" value="Saved" />
          <HeroBadge label="Next" value="Retry" />
        </View>
      </HeroPanel>

      <View style={styles.card}>
        <StepRail currentStep={4} />
        <Text style={styles.sectionTitle}>{composer.title}</Text>
        <Text style={styles.mutedCopy}>{presentation.detailCopy}</Text>

        <Text style={styles.fieldLabel}>Attempt timeline</Text>
        <View style={styles.timelineWrap}>
          {composer.timeline.map((state) => (
            <StatusChip key={state} label={humanizeToken(state)} tone={state} />
          ))}
        </View>

        <ActionButton disabled={isBusy} label="Retry generation" onPress={onRetry} tone="primary" />
        <ActionButton disabled={isBusy} label="Back to goals" onPress={onBack} tone="ghost" />
      </View>
    </>
  );
}
