import { Text, TextInput, View } from "react-native";

import { DEMO_SCENARIOS, GENERATION_SCENARIOS } from "../constants.js";
import { humanizeToken } from "../model.js";
import { ActionButton, ChoicePill, GoalRow } from "../components/Primitives.js";
import { styles } from "../../../ui/styles.js";

export function DeveloperLab({
  apiBaseUrl,
  busyLabel,
  devLabOpen,
  devSessionInfo,
  generationScenario,
  isBusy,
  onBootstrapScenario,
  onChangeApiBaseUrl,
  onRefreshSnapshot,
  onSaveApiBaseUrl,
  onSelectGenerationScenario,
  onStartOver,
  onToggleDevLab
}) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderCopy}>
          <Text style={styles.sectionTitle}>Validation lab</Text>
          <Text style={styles.mutedCopy}>
            Keep preview-state controls nearby without letting them take over the main product UI.
          </Text>
        </View>
        <ActionButton
          disabled={isBusy}
          label={devLabOpen ? "Hide" : "Open"}
          onPress={onToggleDevLab}
          tone="secondary"
          compact
        />
      </View>

      {devLabOpen ? (
        <>
          <Text style={styles.fieldLabel}>API base URL</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={onChangeApiBaseUrl}
            placeholder="http://127.0.0.1:3000"
            placeholderTextColor="#8B7E73"
            style={styles.input}
            value={apiBaseUrl}
          />

          <View style={styles.inlineActionRow}>
            <View style={styles.inlineActionItem}>
              <ActionButton
                disabled={isBusy}
                label="Save URL"
                onPress={onSaveApiBaseUrl}
                tone="secondary"
              />
            </View>
            <View style={styles.inlineActionItem}>
              <ActionButton
                disabled={isBusy}
                label="Refresh"
                onPress={onRefreshSnapshot}
                tone="secondary"
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Demo scenarios</Text>
          {DEMO_SCENARIOS.map((scenario) => (
            <GoalRow
              key={scenario.id}
              actionLabel="Load"
              compactAction
              disabled={isBusy}
              onPress={() => onBootstrapScenario(scenario.id)}
              summary={scenario.description}
              title={scenario.label}
            />
          ))}

          <Text style={styles.fieldLabel}>Plan generation mock</Text>
          <View style={styles.pillWrap}>
            {GENERATION_SCENARIOS.map((scenario) => (
              <ChoicePill
                key={scenario.id}
                active={generationScenario === scenario.id}
                disabled={isBusy}
                label={scenario.label}
                onPress={() => onSelectGenerationScenario(scenario.id)}
              />
            ))}
          </View>

          {devSessionInfo ? (
            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>Last loaded</Text>
              <Text style={styles.noteCopy}>
                {humanizeToken(devSessionInfo.scenario)} on {devSessionInfo.local_date_key}
              </Text>
              <Text style={styles.noteCopy}>
                Goals: {devSessionInfo.summary.goal_count} · Today tasks: {devSessionInfo.summary.today_task_count}
              </Text>
            </View>
          ) : null}

          <ActionButton
            disabled={isBusy}
            label={busyLabel || "Start over"}
            onPress={onStartOver}
            tone="danger"
          />
        </>
      ) : null}
    </View>
  );
}
