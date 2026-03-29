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

export function GeneratingScreen({ composer, isBusy, onCancel, onRefreshStatus }) {
  const presentation = getGenerationStateContent(composer.planState);

  return (
    <>
      <HeroPanel
        eyebrow="Goal plan"
        title={presentation.title}
        copy={presentation.heroCopy}
      >
        <View style={styles.heroStatRow}>
          <HeroBadge label="Goal" value="Generating" />
          <HeroBadge label="State" value={humanizeToken(composer.planState)} />
        </View>
      </HeroPanel>

      <View style={styles.card}>
        <StepRail currentStep={4} />
        <Text style={styles.sectionTitle}>{composer.title}</Text>
        <Text style={styles.mutedCopy}>{presentation.detailCopy}</Text>

        <Text style={styles.fieldLabel}>Plan state timeline</Text>
        <View style={styles.timelineWrap}>
          {composer.timeline.map((state) => (
            <StatusChip key={state} label={humanizeToken(state)} tone={state} />
          ))}
        </View>

        <View style={styles.inlineActionRow}>
          <View style={styles.inlineActionItem}>
            <ActionButton
              disabled={isBusy}
              label="Check again"
              onPress={onRefreshStatus}
              tone="secondary"
            />
          </View>
          <View style={styles.inlineActionItem}>
            <ActionButton disabled={isBusy} label="Back to goals" onPress={onCancel} tone="ghost" />
          </View>
        </View>
      </View>
    </>
  );
}
