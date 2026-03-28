import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import {
  bootstrapDemoSession,
  createGoal,
  fetchGoals,
  fetchPlanStatus,
  fetchProgress,
  fetchTodayTasks,
  generatePlan,
  resetDemoSession,
  submitAssessment
} from "./src/api/goalCoachApi";
import {
  clearGuestSession,
  createGuestSession,
  DEFAULT_API_BASE_URL,
  readGuestSession,
  writeGuestSession
} from "./src/storage/guestSession";

const DEMO_SCENARIOS = [
  { id: "starter", label: "Clean Start", description: "Empty account, ready for onboarding." },
  { id: "active_goal_ready", label: "Active Goal", description: "Ready plan with tasks for today." },
  { id: "no_active_goal", label: "No Active Goal", description: "Goals exist, but nothing is active." },
  { id: "no_tasks_today", label: "No Tasks Today", description: "Active goal exists, but today is clear." }
];

const GENERATION_SCENARIOS = [
  { id: "ready", label: "Ready" },
  { id: "delay", label: "Delay" },
  { id: "fail", label: "Fail" }
];

const DEFAULT_GOAL_TITLE = "Learn React by building 2 projects by 2026-10-01";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNotFound(error) {
  return error?.status === 404;
}

function createEmptyGenerationState() {
  return {
    phase: "idle",
    goalId: null,
    plan: null,
    timeline: []
  };
}

export default function App() {
  const [hydrating, setHydrating] = useState(true);
  const [session, setSession] = useState(null);
  const [apiBaseUrlDraft, setApiBaseUrlDraft] = useState(DEFAULT_API_BASE_URL);
  const [busyLabel, setBusyLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [devSessionInfo, setDevSessionInfo] = useState(null);
  const [snapshot, setSnapshot] = useState({
    goals: [],
    today: null,
    progress: null
  });
  const [generationScenario, setGenerationScenario] = useState("ready");
  const [generationState, setGenerationState] = useState(createEmptyGenerationState());

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const storedSession = await readGuestSession();

        if (cancelled) {
          return;
        }

        if (!storedSession) {
          setApiBaseUrlDraft(DEFAULT_API_BASE_URL);
          return;
        }

        setSession(storedSession);
        setApiBaseUrlDraft(storedSession.apiBaseUrl);
        await loadSnapshot(storedSession);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message);
        }
      } finally {
        if (!cancelled) {
          setHydrating(false);
        }
      }
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadSnapshot(activeSession = session) {
    if (!activeSession) {
      return;
    }

    const [goalsResponse, todayResponse, progressResponse] = await Promise.all([
      fetchGoals(activeSession.apiBaseUrl, activeSession.userId),
      fetchTodayTasks(activeSession.apiBaseUrl, activeSession.userId).catch((error) => (
        isNotFound(error) ? null : Promise.reject(error)
      )),
      fetchProgress(activeSession.apiBaseUrl, activeSession.userId).catch((error) => (
        isNotFound(error) ? null : Promise.reject(error)
      ))
    ]);

    setSnapshot({
      goals: goalsResponse.goals ?? [],
      today: todayResponse,
      progress: progressResponse?.progress ?? null
    });
  }

  async function runBusyAction(label, task) {
    setBusyLabel(label);
    setErrorMessage("");

    try {
      await task();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setBusyLabel("");
    }
  }

  async function handleContinue() {
    await runBusyAction("Starting guest session", async () => {
      const nextSession = createGuestSession(apiBaseUrlDraft.trim() || DEFAULT_API_BASE_URL);

      await writeGuestSession(nextSession);
      setSession(nextSession);
      setApiBaseUrlDraft(nextSession.apiBaseUrl);

      const bootstrappedSession = await bootstrapDemoSession(
        nextSession.apiBaseUrl,
        nextSession.userId,
        "starter"
      );

      setDevSessionInfo(bootstrappedSession);
      setGenerationState(createEmptyGenerationState());
      await loadSnapshot(nextSession);
    });
  }

  async function handleSaveApiBaseUrl() {
    if (!session) {
      return;
    }

    await runBusyAction("Saving API URL", async () => {
      const nextSession = {
        ...session,
        apiBaseUrl: apiBaseUrlDraft.trim() || DEFAULT_API_BASE_URL
      };

      await writeGuestSession(nextSession);
      setSession(nextSession);
      await loadSnapshot(nextSession);
    });
  }

  function handleStartOver() {
    Alert.alert(
      "Start over?",
      "This clears the local guest session so you can go through Continue again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start over",
          style: "destructive",
          onPress: async () => {
            await clearGuestSession();
            setSession(null);
            setApiBaseUrlDraft(DEFAULT_API_BASE_URL);
            setDevSessionInfo(null);
            setSnapshot({ goals: [], today: null, progress: null });
            setGenerationState(createEmptyGenerationState());
            setErrorMessage("");
          }
        }
      ]
    );
  }

  async function handleBootstrapScenario(scenario) {
    if (!session) {
      return;
    }

    await runBusyAction(`Loading ${scenario}`, async () => {
      const payload =
        scenario === "starter"
          ? await resetDemoSession(session.apiBaseUrl, session.userId)
          : await bootstrapDemoSession(session.apiBaseUrl, session.userId, scenario);

      setDevSessionInfo(payload);
      setGenerationState(createEmptyGenerationState());
      await loadSnapshot(session);
    });
  }

  async function handleRefreshSnapshot() {
    if (!session) {
      return;
    }

    await runBusyAction("Refreshing snapshot", async () => {
      await loadSnapshot(session);
    });
  }

  async function handleRunGenerationLab() {
    if (!session) {
      return;
    }

    await runBusyAction(`Running ${generationScenario} generation`, async () => {
      const resetPayload = await resetDemoSession(session.apiBaseUrl, session.userId);
      setDevSessionInfo(resetPayload);

      const createdGoal = await createGoal(
        session.apiBaseUrl,
        session.userId,
        DEFAULT_GOAL_TITLE
      );
      const goalId = createdGoal.goal.id;

      await submitAssessment(session.apiBaseUrl, session.userId, goalId, {
        current_level: "beginner",
        weekly_minutes_available: 180,
        target_date: "2026-12-31"
      });

      const initialGeneration = await generatePlan(
        session.apiBaseUrl,
        session.userId,
        goalId,
        generationScenario
      );

      setGenerationState({
        phase: initialGeneration.plan_state,
        goalId,
        plan: null,
        timeline: [initialGeneration.plan_state]
      });

      for (let attempt = 0; attempt < 24; attempt += 1) {
        await sleep(generationScenario === "delay" ? 220 : 120);
        const status = await fetchPlanStatus(session.apiBaseUrl, session.userId, goalId);

        setGenerationState((current) => ({
          phase: status.plan_state,
          goalId,
          plan: status.plan,
          timeline:
            current.timeline[current.timeline.length - 1] === status.plan_state
              ? current.timeline
              : [...current.timeline, status.plan_state]
        }));

        if (status.plan_state === "ready" || status.plan_state === "failed") {
          break;
        }
      }

      await loadSnapshot(session);
    });
  }

  if (hydrating) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <BackgroundArt />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#0B6E6E" />
          <Text style={styles.loadingTitle}>Warming up your coach workspace</Text>
          <Text style={styles.loadingCopy}>Loading any saved guest session from this device.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <BackgroundArt />
      {!session ? (
        <WelcomeScreen
          apiBaseUrl={apiBaseUrlDraft}
          busyLabel={busyLabel}
          errorMessage={errorMessage}
          onChangeApiBaseUrl={setApiBaseUrlDraft}
          onContinue={handleContinue}
        />
      ) : (
        <DashboardScreen
          apiBaseUrl={apiBaseUrlDraft}
          busyLabel={busyLabel}
          devSessionInfo={devSessionInfo}
          errorMessage={errorMessage}
          generationScenario={generationScenario}
          generationState={generationState}
          onBootstrapScenario={handleBootstrapScenario}
          onChangeApiBaseUrl={setApiBaseUrlDraft}
          onRefreshSnapshot={handleRefreshSnapshot}
          onRunGenerationLab={handleRunGenerationLab}
          onSaveApiBaseUrl={handleSaveApiBaseUrl}
          onSelectGenerationScenario={setGenerationScenario}
          onStartOver={handleStartOver}
          session={session}
          snapshot={snapshot}
        />
      )}
    </SafeAreaView>
  );
}

function WelcomeScreen({
  apiBaseUrl,
  busyLabel,
  errorMessage,
  onChangeApiBaseUrl,
  onContinue
}) {
  return (
    <View style={styles.welcomeWrap}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Guest-only local mode</Text>
        <Text style={styles.heroTitle}>Continue straight into the app.</Text>
        <Text style={styles.heroCopy}>
          Tap Continue to create a guest user on this device, save it locally with AsyncStorage,
          and land in a UI playground that can reset itself into deterministic demo states.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>API Base URL</Text>
        <Text style={styles.mutedCopy}>
          Use `127.0.0.1` for iOS Simulator. The current validation cycle is iOS-only.
        </Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onChangeText={onChangeApiBaseUrl}
          placeholder="http://127.0.0.1:3000"
          placeholderTextColor="#7F8C8D"
          style={styles.input}
          value={apiBaseUrl}
        />
        {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
        <ActionButton
          label={busyLabel || "Continue"}
          onPress={onContinue}
          tone="primary"
        />
      </View>
    </View>
  );
}

function DashboardScreen({
  apiBaseUrl,
  busyLabel,
  devSessionInfo,
  errorMessage,
  generationScenario,
  generationState,
  onBootstrapScenario,
  onChangeApiBaseUrl,
  onRefreshSnapshot,
  onRunGenerationLab,
  onSaveApiBaseUrl,
  onSelectGenerationScenario,
  onStartOver,
  session,
  snapshot
}) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Guest session active</Text>
        <Text style={styles.heroTitle}>UI playground for the Goal Coach app.</Text>
        <Text style={styles.heroCopy}>
          Your guest user lives only on this device. The dashboard below gives you one-tap states
          for empty, ready, no-active-goal, no-tasks, and mocked generation outcomes.
        </Text>
        <View style={styles.inlinePills}>
          <MetricPill label="User" value={session.userId} />
          <MetricPill label="Mode" value="Guest" />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Session</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onChangeText={onChangeApiBaseUrl}
          placeholder="http://127.0.0.1:3000"
          placeholderTextColor="#7F8C8D"
          style={styles.input}
          value={apiBaseUrl}
        />
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <ActionButton label="Save API URL" onPress={onSaveApiBaseUrl} tone="secondary" />
          </View>
          <View style={styles.rowItem}>
            <ActionButton label="Refresh" onPress={onRefreshSnapshot} tone="secondary" />
          </View>
        </View>
        <ActionButton label="Start Over" onPress={onStartOver} tone="ghost" />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Demo State Bootstrap</Text>
        <Text style={styles.mutedCopy}>
          These buttons clear the current guest dataset and reseed deterministic app states.
        </Text>
        {DEMO_SCENARIOS.map((scenario) => (
          <View key={scenario.id} style={styles.scenarioRow}>
            <View style={styles.scenarioCopy}>
              <Text style={styles.scenarioLabel}>{scenario.label}</Text>
              <Text style={styles.scenarioDescription}>{scenario.description}</Text>
            </View>
            <ActionButton
              label="Load"
              onPress={() => onBootstrapScenario(scenario.id)}
              tone="secondary"
              compact
            />
          </View>
        ))}
        {devSessionInfo ? (
          <View style={styles.devSummary}>
            <Text style={styles.devSummaryText}>
              Loaded `{devSessionInfo.scenario}` for `{devSessionInfo.local_date_key}`.
            </Text>
            <Text style={styles.devSummaryText}>
              Goals: {devSessionInfo.summary.goal_count} | Today tasks: {devSessionInfo.summary.today_task_count}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Generation Lab</Text>
        <Text style={styles.mutedCopy}>
          This creates a fresh specific goal, submits assessment, and triggers generation with the
          selected mock scenario header.
        </Text>
        <View style={styles.choiceRow}>
          {GENERATION_SCENARIOS.map((scenario) => (
            <ChoicePill
              key={scenario.id}
              active={generationScenario === scenario.id}
              label={scenario.label}
              onPress={() => onSelectGenerationScenario(scenario.id)}
            />
          ))}
        </View>
        <ActionButton label="Run Generation Flow" onPress={onRunGenerationLab} tone="primary" />
        <View style={styles.devSummary}>
          <Text style={styles.devSummaryText}>Goal title: {DEFAULT_GOAL_TITLE}</Text>
          <Text style={styles.devSummaryText}>
            State: {generationState.phase} {generationState.goalId ? `| Goal ${generationState.goalId}` : ""}
          </Text>
          {generationState.timeline.length > 0 ? (
            <Text style={styles.devSummaryText}>
              Timeline: {generationState.timeline.join(" -> ")}
            </Text>
          ) : null}
          {generationState.plan?.estimate ? (
            <Text style={styles.devSummaryText}>
              Estimate: {generationState.plan.estimate.min_weeks}-{generationState.plan.estimate.max_weeks} weeks
            </Text>
          ) : null}
        </View>
      </View>

      {errorMessage ? <ErrorBanner message={errorMessage} /> : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Live Snapshot</Text>
        <View style={styles.inlinePills}>
          <MetricPill label="Goals" value={String(snapshot.goals.length)} />
          <MetricPill
            label="Today"
            value={snapshot.today ? String(snapshot.today.tasks.length) : "No active goal"}
          />
          <MetricPill
            label="Streak"
            value={snapshot.progress ? String(snapshot.progress.streak.current_days) : "-"}
          />
        </View>

        <Text style={styles.listHeading}>Goals</Text>
        {snapshot.goals.length === 0 ? (
          <Text style={styles.emptyLine}>No goals yet. Use Clean Start to test onboarding from zero.</Text>
        ) : (
          snapshot.goals.map((goal) => (
            <View key={goal.id} style={styles.listRow}>
              <Text style={styles.listPrimary}>{goal.title}</Text>
              <Text style={styles.listSecondary}>{goal.status} | {goal.plan_state ?? "no_plan"}</Text>
            </View>
          ))
        )}

        <Text style={styles.listHeading}>Today</Text>
        {!snapshot.today ? (
          <Text style={styles.emptyLine}>No active goal is selected right now.</Text>
        ) : snapshot.today.tasks.length === 0 ? (
          <Text style={styles.emptyLine}>Today is clear. The no-tasks state is ready to design.</Text>
        ) : (
          snapshot.today.tasks.map((task) => (
            <View key={task.id} style={styles.listRow}>
              <Text style={styles.listPrimary}>{task.title}</Text>
              <Text style={styles.listSecondary}>{task.est_minutes} min | {task.difficulty}</Text>
            </View>
          ))
        )}

        <Text style={styles.listHeading}>Progress</Text>
        {!snapshot.progress ? (
          <Text style={styles.emptyLine}>No progress payload yet because there is no active goal.</Text>
        ) : (
          <View style={styles.progressRow}>
            <MetricPill label="Adherence" value={`${Math.round(snapshot.progress.adherence_7d * 100)}%`} />
            <MetricPill label="Milestones" value={String(snapshot.progress.milestones_done)} />
            <MetricPill label="Plan" value={`v${snapshot.progress.plan_version}`} />
          </View>
        )}
      </View>

      {busyLabel ? (
        <View style={styles.busyFooter}>
          <ActivityIndicator size="small" color="#0B6E6E" />
          <Text style={styles.busyText}>{busyLabel}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function BackgroundArt() {
  return (
    <View pointerEvents="none" style={styles.backgroundWrap}>
      <View style={styles.orbOne} />
      <View style={styles.orbTwo} />
      <View style={styles.orbThree} />
    </View>
  );
}

function ActionButton({ compact = false, label, onPress, tone }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonBase,
        tone === "primary" ? styles.buttonPrimary : null,
        tone === "secondary" ? styles.buttonSecondary : null,
        tone === "ghost" ? styles.buttonGhost : null,
        compact ? styles.buttonCompact : null,
        pressed ? styles.buttonPressed : null
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          tone === "primary" ? styles.buttonTextPrimary : null,
          tone === "ghost" ? styles.buttonTextGhost : null
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ChoicePill({ active, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choicePill,
        active ? styles.choicePillActive : null,
        pressed ? styles.buttonPressed : null
      ]}
    >
      <Text style={[styles.choicePillText, active ? styles.choicePillTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function MetricPill({ label, value }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function ErrorBanner({ message }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const headingFont = Platform.select({
  ios: "Avenir Next",
  android: "sans-serif-medium",
  default: undefined
});

const serifFont = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: undefined
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F1E3"
  },
  backgroundWrap: {
    ...StyleSheet.absoluteFillObject
  },
  orbOne: {
    position: "absolute",
    top: -120,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#F4B266"
  },
  orbTwo: {
    position: "absolute",
    top: 180,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#B9E3C6"
  },
  orbThree: {
    position: "absolute",
    bottom: -80,
    right: -40,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "#DDE8F2"
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32
  },
  loadingTitle: {
    fontSize: 24,
    color: "#12343B",
    fontFamily: headingFont,
    fontWeight: "700",
    textAlign: "center"
  },
  loadingCopy: {
    fontSize: 15,
    color: "#4F5D61",
    textAlign: "center",
    lineHeight: 22
  },
  welcomeWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 18
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 18
  },
  heroCard: {
    backgroundColor: "#12343B",
    borderRadius: 28,
    padding: 24,
    gap: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4
  },
  eyebrow: {
    color: "#F4B266",
    textTransform: "uppercase",
    letterSpacing: 1.6,
    fontSize: 12,
    fontFamily: serifFont
  },
  heroTitle: {
    color: "#F7F1E3",
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    fontFamily: headingFont
  },
  heroCopy: {
    color: "#DCE8E8",
    fontSize: 15,
    lineHeight: 24
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.84)",
    borderRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(18,52,59,0.08)"
  },
  sectionTitle: {
    color: "#12343B",
    fontSize: 22,
    fontWeight: "700",
    fontFamily: headingFont
  },
  mutedCopy: {
    color: "#587177",
    fontSize: 14,
    lineHeight: 21
  },
  input: {
    backgroundColor: "#F8F7F2",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D5DED8",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#12343B"
  },
  row: {
    flexDirection: "row",
    gap: 10
  },
  rowItem: {
    flex: 1
  },
  buttonBase: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  buttonPrimary: {
    backgroundColor: "#0B6E6E"
  },
  buttonSecondary: {
    backgroundColor: "#E6EFE8"
  },
  buttonGhost: {
    backgroundColor: "#F4EBDA",
    borderWidth: 1,
    borderColor: "#E7D6B3"
  },
  buttonCompact: {
    minHeight: 40,
    paddingHorizontal: 14
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }]
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#12343B"
  },
  buttonTextPrimary: {
    color: "#F7F1E3"
  },
  buttonTextGhost: {
    color: "#8A4B08"
  },
  inlinePills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metricPill: {
    backgroundColor: "#F8F1E2",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  metricLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#7F5D32"
  },
  metricValue: {
    color: "#12343B",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2
  },
  scenarioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  scenarioCopy: {
    flex: 1,
    gap: 2
  },
  scenarioLabel: {
    color: "#12343B",
    fontSize: 15,
    fontWeight: "700"
  },
  scenarioDescription: {
    color: "#5F767B",
    fontSize: 13,
    lineHeight: 18
  },
  devSummary: {
    backgroundColor: "#F3F7F5",
    borderRadius: 18,
    padding: 14,
    gap: 4
  },
  devSummaryText: {
    color: "#365157",
    fontSize: 13,
    lineHeight: 18
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  choicePill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#EEF2EF"
  },
  choicePillActive: {
    backgroundColor: "#12343B"
  },
  choicePillText: {
    color: "#365157",
    fontWeight: "700"
  },
  choicePillTextActive: {
    color: "#F7F1E3"
  },
  listHeading: {
    color: "#12343B",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4
  },
  listRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#E8ECE7",
    paddingBottom: 10,
    gap: 2
  },
  listPrimary: {
    color: "#12343B",
    fontSize: 14,
    fontWeight: "600"
  },
  listSecondary: {
    color: "#678086",
    fontSize: 12
  },
  emptyLine: {
    color: "#61777B",
    fontSize: 14,
    lineHeight: 20
  },
  progressRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  errorBanner: {
    backgroundColor: "#FFE4DE",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F0B7A8"
  },
  errorText: {
    color: "#7A2F16",
    lineHeight: 20
  },
  busyFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 8
  },
  busyText: {
    color: "#365157",
    fontSize: 14,
    fontWeight: "600"
  }
});
