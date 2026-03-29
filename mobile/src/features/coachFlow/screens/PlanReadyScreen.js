import { Text, View } from "react-native";

import { formatEstimate, formatPercent, getGenerationStateContent, humanizeToken } from "../model.js";
import {
  ActionButton,
  HeroBadge,
  HeroPanel,
  MetricTile,
  MilestonePreviewRow,
  TaskPreviewRow
} from "../components/Primitives.js";
import { styles } from "../../../ui/styles.js";

export function PlanReadyScreen({ composer, isBusy, onActivate, onBackToGoals }) {
  const presentation = getGenerationStateContent("ready");

  return (
    <>
      <HeroPanel
        eyebrow="Goal plan"
        title={composer.title}
        copy={presentation.heroCopy}
      >
        <View style={styles.heroStatRow}>
          <HeroBadge label="Estimate" value={formatEstimate(composer.plan?.estimate)} />
          <HeroBadge label="Version" value={`v${composer.plan?.version ?? 1}`} />
        </View>
      </HeroPanel>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Plan snapshot</Text>
        <View style={styles.metricGrid}>
          <MetricTile label="Estimated time" value={formatEstimate(composer.plan?.estimate)} />
          <MetricTile label="Feasibility" value={humanizeToken(composer.plan?.feasibility ?? "realistic")} />
          <MetricTile label="Frame" value={humanizeToken(composer.plan?.frame_type ?? "custom")} />
          <MetricTile
            label="Confidence"
            value={formatPercent(composer.plan?.estimate?.confidence ?? 0)}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Milestones</Text>
        {composer.plan?.milestones?.map((milestone) => (
          <MilestonePreviewRow
            key={`${milestone.title}-${milestone.target_week}`}
            milestone={milestone}
          />
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>First tasks</Text>
        {composer.plan?.first_tasks?.map((task) => (
          <TaskPreviewRow key={`${task.title}-${task.est_minutes}`} task={task} />
        ))}
        <ActionButton disabled={isBusy} label="Start this plan" onPress={onActivate} tone="primary" />
        <ActionButton
          disabled={isBusy}
          label="Back to goals"
          onPress={onBackToGoals}
          tone="ghost"
        />
      </View>
    </>
  );
}
