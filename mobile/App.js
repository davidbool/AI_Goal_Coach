import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";

import {
  activateGoal,
  bootstrapDemoSession,
  completeTask,
  confirmMilestone,
  createGoal,
  fetchAppBootstrap,
  fetchPlanStatus,
  generatePlan,
  resetDemoSession,
  skipTask,
  softAdjustActiveGoal,
  submitAssessment,
  submitClarifications
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

const LEVEL_OPTIONS = [
  { id: "beginner", label: "Beginner" },
  { id: "novice", label: "Novice" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" }
];

const GOAL_PROMPTS = [
  "Learn React by building 2 projects by 2026-10-01",
  "Run 5km 3 times per week by 2026-12-01",
  "Speak conversational Hebrew by practicing 25 minutes a day for 5 months"
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addDays(days) {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

function createEmptySnapshot() {
  return {
    user: null,
    localDateKey: null,
    goals: [],
    activeGoal: null,
    today: null,
    progress: null
  };
}

function createDefaultAssessment() {
  return {
    currentLevel: "beginner",
    weeklyMinutesAvailable: "180",
    targetDate: addDays(84)
  };
}

function createEmptyComposer() {
  return {
    stage: "idle",
    title: "",
    goalId: null,
    specificity: null,
    clarificationFields: [],
    assessment: createDefaultAssessment(),
    planState: "idle",
    plan: null,
    timeline: []
  };
}

function toClarificationFields(questions = []) {
  return questions.map((questionText, index) => ({
    id: `clarification-${index + 1}`,
    questionText,
    answerText: ""
  }));
}

function pushTimeline(timeline, nextValue) {
  if (!nextValue) {
    return timeline;
  }

  if (timeline[timeline.length - 1] === nextValue) {
    return timeline;
  }

  return [...timeline, nextValue];
}

function humanizeToken(value) {
  return String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPercent(value) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function formatEstimate(estimate) {
  if (!estimate) {
    return "Custom pacing";
  }

  return `${estimate.min_weeks}-${estimate.max_weeks} weeks`;
}

function getTaskMinutes(task) {
  return task.est_minutes ?? task.estMinutes ?? 0;
}

function isGoalActivatable(goal) {
  return goal?.specificity_state === "specific" && goal?.status !== "active" && goal?.status !== "archived";
}

function createGoalSummary(goal) {
  const goalStatus = humanizeToken(goal.status);
  const planStatus = goal.plan_state ? humanizeToken(goal.plan_state) : "No plan yet";
  const specificity = goal.specificity_state === "specific" ? "Specific" : "Needs clarity";

  return `${goalStatus} · ${planStatus} · ${specificity}`;
}

function getStageSurface(snapshot, composer) {
  if (composer.stage !== "idle") {
    return composer.stage === "intake" ? "goal_studio" : composer.stage;
  }

  if (snapshot.activeGoal) {
    return "dashboard";
  }

  return "goal_studio";
}

function getGenerationCopy(planState) {
  if (planState === "delayed") {
    return "The plan is taking a little longer than usual. Keep this screen open and we will catch the moment it is ready.";
  }

  if (planState === "ready") {
    return "Your first plan arc is ready. Review the milestones and start when it feels right.";
  }

  if (planState === "failed") {
    return "We could not finish this draft. Your goal and assessment are still saved, so you can try again without losing work.";
  }

  return "We are turning your goal into a realistic weekly path and a gentle first day.";
}

export default function App() {
  const [hydrating, setHydrating] = useState(true);
  const [session, setSession] = useState(null);
  const [apiBaseUrlDraft, setApiBaseUrlDraft] = useState(DEFAULT_API_BASE_URL);
  const [busyLabel, setBusyLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [coachMessage, setCoachMessage] = useState("");
  const [devSessionInfo, setDevSessionInfo] = useState(null);
  const [snapshot, setSnapshot] = useState(createEmptySnapshot());
  const [composer, setComposer] = useState(createEmptyComposer());
  const [generationScenario, setGenerationScenario] = useState("ready");
  const [devLabOpen, setDevLabOpen] = useState(false);

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

    const bootstrap = await fetchAppBootstrap(activeSession.apiBaseUrl, activeSession.userId);

    setSnapshot({
      user: bootstrap.user ?? null,
      localDateKey: bootstrap.local_date_key ?? null,
      goals: bootstrap.goals ?? [],
      activeGoal: bootstrap.active_goal ?? null,
      today: bootstrap.today ?? null,
      progress: bootstrap.progress ?? null
    });
  }

  function resetComposer(nextTitle = "") {
    setComposer({
      ...createEmptyComposer(),
      title: nextTitle
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
    await runBusyAction("Preparing your guest coach", async () => {
      const nextSession = createGuestSession(apiBaseUrlDraft.trim() || DEFAULT_API_BASE_URL);

      await writeGuestSession(nextSession);
      setSession(nextSession);
      setApiBaseUrlDraft(nextSession.apiBaseUrl);

      const seededSession = await bootstrapDemoSession(
        nextSession.apiBaseUrl,
        nextSession.userId,
        "starter"
      );

      setDevSessionInfo(seededSession);
      setCoachMessage("Your local guest workspace is ready. Let's define one goal worth acting on.");
      resetComposer("");
      await loadSnapshot(nextSession);
    });
  }

  async function handleSaveApiBaseUrl() {
    if (!session) {
      return;
    }

    await runBusyAction("Saving API base URL", async () => {
      const nextSession = {
        ...session,
        apiBaseUrl: apiBaseUrlDraft.trim() || DEFAULT_API_BASE_URL
      };

      await writeGuestSession(nextSession);
      setSession(nextSession);
      setCoachMessage("Saved. Future requests will use the updated API address.");
      await loadSnapshot(nextSession);
    });
  }

  function handleStartOver() {
    Alert.alert(
      "Start over?",
      "This clears the local guest session and resets the mobile app back to its first screen.",
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
            setSnapshot(createEmptySnapshot());
            setGenerationScenario("ready");
            resetComposer("");
            setErrorMessage("");
            setCoachMessage("");
            setDevLabOpen(false);
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
      setCoachMessage(`Loaded "${humanizeToken(payload.scenario)}" so we can design against a stable state.`);
      resetComposer("");
      await loadSnapshot(session);
    });
  }

  async function handleRefreshSnapshot() {
    if (!session) {
      return;
    }

    await runBusyAction("Refreshing app snapshot", async () => {
      await loadSnapshot(session);
      setCoachMessage("Fresh snapshot loaded from the API.");
    });
  }

  function handleChangeGoalTitle(value) {
    setErrorMessage("");
    setComposer((current) => ({
      ...current,
      title: value
    }));
  }

  function handleSelectGoalPrompt(value) {
    setErrorMessage("");
    setComposer((current) => ({
      ...current,
      title: value
    }));
  }

  function handleStartNewGoal() {
    setCoachMessage("");
    setErrorMessage("");
    setComposer((current) => ({
      ...createEmptyComposer(),
      title: current.title,
      stage: "intake"
    }));
  }

  function handleCancelComposer() {
    setCoachMessage("No rush. We can come back to this goal whenever you want.");
    setErrorMessage("");
    resetComposer("");
  }

  async function handleCreateGoal() {
    if (!session) {
      return;
    }

    const nextTitle = composer.title.trim();

    if (!nextTitle) {
      setErrorMessage("Write one concrete goal sentence to get started.");
      return;
    }

    await runBusyAction("Shaping your goal", async () => {
      const created = await createGoal(session.apiBaseUrl, session.userId, nextTitle);
      const needsClarification = created.specificity?.state === "needs_clarification";

      setComposer((current) => ({
        ...current,
        stage: needsClarification ? "clarify" : "assessment",
        goalId: created.goal.id,
        title: created.goal.title,
        specificity: created.specificity ?? null,
        clarificationFields: needsClarification
          ? toClarificationFields(created.specificity?.clarification_questions ?? [])
          : [],
        planState: created.goal.plan_state ?? "idle",
        plan: null,
        timeline: []
      }));

      setCoachMessage(
        needsClarification
          ? "Strong start. A couple of details will help the coach build something realistic."
          : "This goal is already specific enough. Now let's tune the pace to your real week."
      );

      await loadSnapshot(session);
    });
  }

  function handleClarificationChange(fieldId, answerText) {
    setErrorMessage("");
    setComposer((current) => ({
      ...current,
      clarificationFields: current.clarificationFields.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              answerText
            }
          : field
      )
    }));
  }

  async function handleSubmitClarifications() {
    if (!session || !composer.goalId) {
      return;
    }

    const pendingEmptyAnswer = composer.clarificationFields.some((field) => field.answerText.trim().length === 0);

    if (pendingEmptyAnswer) {
      setErrorMessage("Answer each clarification prompt so the goal becomes measurable.");
      return;
    }

    await runBusyAction("Tightening goal details", async () => {
      const payload = composer.clarificationFields.map((field) => ({
        question_text: field.questionText,
        answer_text: field.answerText.trim()
      }));

      const result = await submitClarifications(
        session.apiBaseUrl,
        session.userId,
        composer.goalId,
        payload
      );

      const stillNeedsClarification = result.specificity?.state === "needs_clarification";

      setComposer((current) => ({
        ...current,
        stage: stillNeedsClarification ? "clarify" : "assessment",
        specificity: result.specificity ?? current.specificity,
        clarificationFields: stillNeedsClarification
          ? toClarificationFields(result.specificity?.clarification_questions ?? [])
          : []
      }));

      setCoachMessage(
        stillNeedsClarification
          ? "We are close, but we still need a little more specificity before planning."
          : "Perfect. The goal is concrete enough now, so we can calibrate the workload."
      );

      await loadSnapshot(session);
    });
  }

  function handleAssessmentChange(field, value) {
    setErrorMessage("");
    setComposer((current) => ({
      ...current,
      assessment: {
        ...current.assessment,
        [field]: value
      }
    }));
  }

  function syncPlanStatus(status) {
    setComposer((current) => {
      const nextTimeline = pushTimeline(current.timeline, status.plan_state);

      if (status.plan_state === "ready") {
        return {
          ...current,
          stage: "plan_ready",
          planState: status.plan_state,
          plan: status.plan,
          timeline: nextTimeline
        };
      }

      if (status.plan_state === "failed") {
        return {
          ...current,
          stage: "generation_failed",
          planState: status.plan_state,
          plan: null,
          timeline: nextTimeline
        };
      }

      return {
        ...current,
        stage: "generating",
        planState: status.plan_state,
        plan: status.plan ?? current.plan,
        timeline: nextTimeline
      };
    });
  }

  async function runPlanGeneration(goalId) {
    const initialGeneration = await generatePlan(
      session.apiBaseUrl,
      session.userId,
      goalId,
      generationScenario
    );

    setComposer((current) => ({
      ...current,
      stage: "generating",
      goalId,
      planState: initialGeneration.plan_state,
      plan: null,
      timeline: [initialGeneration.plan_state]
    }));

    const attemptCount = generationScenario === "delay" ? 40 : 26;
    const pauseMs = generationScenario === "delay" ? 220 : 140;

    for (let attempt = 0; attempt < attemptCount; attempt += 1) {
      await sleep(pauseMs);
      const status = await fetchPlanStatus(session.apiBaseUrl, session.userId, goalId);

      syncPlanStatus(status);

      if (status.plan_state === "ready" || status.plan_state === "failed") {
        break;
      }
    }

    await loadSnapshot(session);
  }

  async function handleBuildPlan() {
    if (!session || !composer.goalId) {
      return;
    }

    const weeklyMinutes = Number.parseInt(composer.assessment.weeklyMinutesAvailable, 10);

    if (!Number.isFinite(weeklyMinutes)) {
      setErrorMessage("Weekly minutes should be a number between 30 and 1260.");
      return;
    }

    await runBusyAction("Building your first plan", async () => {
      await submitAssessment(session.apiBaseUrl, session.userId, composer.goalId, {
        current_level: composer.assessment.currentLevel,
        weekly_minutes_available: weeklyMinutes,
        target_date: composer.assessment.targetDate || undefined
      });

      setCoachMessage("Assessment saved. Now we are shaping the first plan version.");
      await runPlanGeneration(composer.goalId);
    });
  }

  async function handleRefreshGenerationStatus() {
    if (!session || !composer.goalId) {
      return;
    }

    await runBusyAction("Checking plan status", async () => {
      const status = await fetchPlanStatus(session.apiBaseUrl, session.userId, composer.goalId);
      syncPlanStatus(status);
      await loadSnapshot(session);
    });
  }

  async function handleRetryGeneration() {
    if (!session || !composer.goalId) {
      return;
    }

    await runBusyAction("Retrying plan generation", async () => {
      setCoachMessage("Trying again with the same goal and assessment.");
      await runPlanGeneration(composer.goalId);
    });
  }

  async function handleActivateGoal(goalId) {
    if (!session || !goalId) {
      return;
    }

    await runBusyAction("Activating this goal", async () => {
      await activateGoal(session.apiBaseUrl, session.userId, goalId);
      setCoachMessage("Your focus has been switched. Today's dashboard is ready.");
      resetComposer("");
      await loadSnapshot(session);
    });
  }

  async function handleCompleteTask(taskId, taskTitle) {
    if (!session) {
      return;
    }

    await runBusyAction("Marking task complete", async () => {
      await completeTask(session.apiBaseUrl, session.userId, taskId, {});
      setCoachMessage(`Nice work. "${taskTitle}" is now marked complete.`);
      await loadSnapshot(session);
    });
  }

  async function handleSkipTask(taskId) {
    if (!session) {
      return;
    }

    await runBusyAction("Skipping task", async () => {
      await skipTask(session.apiBaseUrl, session.userId, taskId, {});
      setCoachMessage("Skipped tasks are signal, not failure. We can adapt from here.");
      await loadSnapshot(session);
    });
  }

  async function handleSoftAdjust() {
    if (!session) {
      return;
    }

    await runBusyAction("Lightening today's plan", async () => {
      const adjusted = await softAdjustActiveGoal(session.apiBaseUrl, session.userId);
      setCoachMessage(adjusted.feedback ?? "We lightened today to protect your momentum.");
      await loadSnapshot(session);
    });
  }

  async function handleConfirmMilestone(milestoneId, title) {
    if (!session) {
      return;
    }

    await runBusyAction("Confirming milestone", async () => {
      await confirmMilestone(session.apiBaseUrl, session.userId, milestoneId);
      setCoachMessage(`Milestone confirmed: "${title}".`);
      await loadSnapshot(session);
    });
  }

  const isBusy = busyLabel.length > 0;
  const surface = getStageSurface(snapshot, composer);
  const commonDevLabProps = {
    apiBaseUrl: apiBaseUrlDraft,
    busyLabel,
    devLabOpen,
    devSessionInfo,
    generationScenario,
    isBusy,
    onBootstrapScenario: handleBootstrapScenario,
    onChangeApiBaseUrl: setApiBaseUrlDraft,
    onRefreshSnapshot: handleRefreshSnapshot,
    onSaveApiBaseUrl: handleSaveApiBaseUrl,
    onSelectGenerationScenario: setGenerationScenario,
    onStartOver: handleStartOver,
    onToggleDevLab: () => setDevLabOpen((current) => !current)
  };

  if (hydrating) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <BackgroundArt />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#B65C3A" />
          <Text style={styles.loadingTitle}>Opening your coaching space</Text>
          <Text style={styles.loadingCopy}>Checking this device for a saved guest session.</Text>
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
        <SessionScroll
          busyLabel={busyLabel}
          coachMessage={coachMessage}
          errorMessage={errorMessage}
        >
          {surface === "goal_studio" ? (
            <GoalStudioScreen
              composer={composer}
              existingGoals={snapshot.goals.filter((goal) => goal.id !== snapshot.activeGoal?.id)}
              hasActiveGoal={Boolean(snapshot.activeGoal)}
              isBusy={isBusy}
              onActivateGoal={handleActivateGoal}
              onCancel={handleCancelComposer}
              onChangeGoalTitle={handleChangeGoalTitle}
              onCreateGoal={handleCreateGoal}
              onSelectGoalPrompt={handleSelectGoalPrompt}
            />
          ) : null}

          {surface === "clarify" ? (
            <ClarificationScreen
              composer={composer}
              isBusy={isBusy}
              onCancel={handleCancelComposer}
              onChangeAnswer={handleClarificationChange}
              onSubmit={handleSubmitClarifications}
            />
          ) : null}

          {surface === "assessment" ? (
            <AssessmentScreen
              composer={composer}
              isBusy={isBusy}
              onBuildPlan={handleBuildPlan}
              onCancel={handleCancelComposer}
              onChangeAssessment={handleAssessmentChange}
            />
          ) : null}

          {surface === "generating" ? (
            <GeneratingScreen
              composer={composer}
              isBusy={isBusy}
              onCancel={handleCancelComposer}
              onRefreshStatus={handleRefreshGenerationStatus}
            />
          ) : null}

          {surface === "plan_ready" ? (
            <PlanReadyScreen
              composer={composer}
              isBusy={isBusy}
              onActivate={() => handleActivateGoal(composer.goalId)}
              onBackToGoals={handleCancelComposer}
            />
          ) : null}

          {surface === "generation_failed" ? (
            <GenerationFailedScreen
              composer={composer}
              isBusy={isBusy}
              onBack={handleCancelComposer}
              onRetry={handleRetryGeneration}
            />
          ) : null}

          {surface === "dashboard" ? (
            <DashboardScreen
              activeGoal={snapshot.activeGoal}
              goals={snapshot.goals}
              isBusy={isBusy}
              localDateKey={snapshot.localDateKey}
              progress={snapshot.progress}
              today={snapshot.today}
              onCompleteTask={handleCompleteTask}
              onConfirmMilestone={handleConfirmMilestone}
              onCreateAnotherGoal={handleStartNewGoal}
              onRefresh={handleRefreshSnapshot}
              onSkipTask={handleSkipTask}
              onSoftAdjust={handleSoftAdjust}
              onSwitchGoal={handleActivateGoal}
            />
          ) : null}

          <DeveloperLab {...commonDevLabProps} />
        </SessionScroll>
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
  const isBusy = busyLabel.length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.welcomeContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <HeroPanel
          eyebrow="AI Goal Coach"
          title="Turn a long-term goal into a calmer daily rhythm."
          copy="This first mobile pass runs in guest mode so we can validate the iOS flow quickly. Start here, shape one goal, and let the coach build a realistic first plan."
        >
          <View style={styles.heroStatRow}>
            <HeroBadge label="Mode" value="Guest / local" />
            <HeroBadge label="Platform" value="iOS-first" />
          </View>
        </HeroPanel>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Continue as a guest</Text>
          <Text style={styles.mutedCopy}>
            We will create a guest user on this device, keep its ID in local storage, and seed a clean starter state so the full intake flow is ready.
          </Text>
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
          <Text style={styles.helperLine}>
            Use `127.0.0.1` for the iOS Simulator when the API is running locally.
          </Text>
          {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
          <ActionButton
            disabled={isBusy}
            label={isBusy ? busyLabel : "Continue"}
            onPress={onContinue}
            tone="primary"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SessionScroll({ busyLabel, coachMessage, errorMessage, children }) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {coachMessage ? <CoachBanner message={coachMessage} /> : null}
        {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
        {children}
        {busyLabel ? <BusyNotice label={busyLabel} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function GoalStudioScreen({
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

  return (
    <>
      <HeroPanel
        eyebrow="Step 1"
        title="Name a goal worth showing up for."
        copy={
          hasActiveGoal
            ? "Your current active goal stays in place until you choose to switch. We can still draft another coaching track right now."
            : "Pick a goal with an outcome and a timeframe. If it is still fuzzy, the app will coach it into focus before building a plan."
        }
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
        <Text style={styles.mutedCopy}>
          Pick up an existing goal, switch focus, or reuse wording from an older draft.
        </Text>
        {existingGoals.length === 0 ? (
          <Text style={styles.emptyLine}>
            No saved goals yet. Your first goal will show up here as soon as you create it.
          </Text>
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

function ClarificationScreen({ composer, isBusy, onCancel, onChangeAnswer, onSubmit }) {
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

function AssessmentScreen({ composer, isBusy, onBuildPlan, onCancel, onChangeAssessment }) {
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

function GeneratingScreen({ composer, isBusy, onCancel, onRefreshStatus }) {
  return (
    <>
      <HeroPanel
        eyebrow="Step 4"
        title={composer.planState === "delayed" ? "Still building your plan" : "Building your first plan"}
        copy={getGenerationCopy(composer.planState)}
      >
        <View style={styles.heroStatRow}>
          <HeroBadge label="Goal" value="Generating" />
          <HeroBadge label="State" value={humanizeToken(composer.planState)} />
        </View>
      </HeroPanel>

      <View style={styles.card}>
        <StepRail currentStep={4} />
        <Text style={styles.sectionTitle}>{composer.title}</Text>
        <Text style={styles.mutedCopy}>
          {composer.planState === "delayed"
            ? "The backend has moved into a delayed state, which is expected in the mocked delay scenario."
            : "We are generating milestones, a pacing estimate, and the first tasks for this goal."}
        </Text>

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

function PlanReadyScreen({ composer, isBusy, onActivate, onBackToGoals }) {
  return (
    <>
      <HeroPanel
        eyebrow="Plan ready"
        title="Your first coaching arc is ready."
        copy="Review the shape of the next weeks, then activate the plan when you are ready to make it the active focus."
      >
        <View style={styles.heroStatRow}>
          <HeroBadge label="Estimate" value={formatEstimate(composer.plan?.estimate)} />
          <HeroBadge label="Version" value={`v${composer.plan?.version ?? 1}`} />
        </View>
      </HeroPanel>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Plan snapshot</Text>
        <View style={styles.metricGrid}>
          <MetricTile label="Frame" value={humanizeToken(composer.plan?.frame_type ?? "custom")} />
          <MetricTile label="Feasibility" value={humanizeToken(composer.plan?.feasibility ?? "realistic")} />
          <MetricTile label="Estimate" value={formatEstimate(composer.plan?.estimate)} />
          <MetricTile label="Confidence" value={formatPercent(composer.plan?.estimate?.confidence ?? 0)} />
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

function GenerationFailedScreen({ composer, isBusy, onBack, onRetry }) {
  return (
    <>
      <HeroPanel
        eyebrow="Plan failed"
        title="We hit a snag building this draft."
        copy={getGenerationCopy("failed")}
      >
        <View style={styles.heroStatRow}>
          <HeroBadge label="Goal" value="Saved" />
          <HeroBadge label="Next" value="Retry" />
        </View>
      </HeroPanel>

      <View style={styles.card}>
        <StepRail currentStep={4} />
        <Text style={styles.sectionTitle}>{composer.title}</Text>
        <Text style={styles.mutedCopy}>
          Your goal and assessment are still on the server. You can retry generation or head back to the library and revisit it later.
        </Text>

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

function DashboardScreen({
  activeGoal,
  goals,
  isBusy,
  localDateKey,
  progress,
  today,
  onCompleteTask,
  onConfirmMilestone,
  onCreateAnotherGoal,
  onRefresh,
  onSkipTask,
  onSoftAdjust,
  onSwitchGoal
}) {
  const otherGoals = goals.filter((goal) => goal.id !== activeGoal?.id);
  const adherenceRate = progress?.adherence?.completion_rate_7d ?? progress?.adherence_7d ?? 0;
  const adherenceWidth = `${Math.max(8, Math.round(adherenceRate * 100))}%`;

  return (
    <>
      <HeroPanel
        eyebrow="Today"
        title={activeGoal?.title ?? "Your active goal"}
        copy={
          today
            ? `Local date: ${localDateKey}. Focus on the next few actions, not the entire mountain.`
            : "You have an active goal, but today's task surface is not ready yet. Refresh or switch focus when needed."
        }
      >
        <View style={styles.heroStatRow}>
          <HeroBadge label="Streak" value={String(progress?.streak?.current_days ?? 0)} />
          <HeroBadge label="Adherence" value={formatPercent(adherenceRate)} />
          <HeroBadge label="Plan" value={`v${progress?.plan_version ?? 1}`} />
        </View>
      </HeroPanel>

      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Today's focus</Text>
          <ActionButton disabled={isBusy} label="Refresh" onPress={onRefresh} tone="secondary" compact />
        </View>
        {today?.feedback ? (
          <View style={styles.noteCard}>
            <Text style={styles.noteCopy}>{today.feedback}</Text>
          </View>
        ) : null}
        {!today ? (
          <Text style={styles.emptyLine}>
            No daily task payload yet. This can happen if the goal is active but a plan has not been generated.
          </Text>
        ) : today.tasks.length === 0 ? (
          <>
            <Text style={styles.emptyLine}>
              Today is intentionally clear. Rest counts too, and you can refresh later if this changes.
            </Text>
            <ActionButton
              disabled={isBusy}
              label="Lighten today anyway"
              onPress={onSoftAdjust}
              tone="secondary"
            />
          </>
        ) : (
          <>
            {today.tasks.map((task) => (
              <TaskCard
                key={task.id}
                disabled={isBusy}
                onComplete={() => onCompleteTask(task.id, task.title)}
                onSkip={() => onSkipTask(task.id)}
                task={task}
              />
            ))}
            <ActionButton disabled={isBusy} label="Lighten today" onPress={onSoftAdjust} tone="secondary" />
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Momentum</Text>
        <View style={styles.metricGrid}>
          <MetricTile label="7-day adherence" value={formatPercent(adherenceRate)} />
          <MetricTile label="Longest streak" value={String(progress?.streak?.longest_days ?? 0)} />
          <MetricTile label="Milestones done" value={String(progress?.milestones_done ?? 0)} />
          <MetricTile label="Last success" value={progress?.streak?.last_success_date ?? "None yet"} />
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: adherenceWidth }]} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Milestones</Text>
        {!progress || progress.milestones.length === 0 ? (
          <Text style={styles.emptyLine}>Milestones will appear here once a plan is active.</Text>
        ) : (
          progress.milestones.map((milestone) => (
            <MilestoneRow
              key={milestone.id}
              disabled={isBusy}
              milestone={milestone}
              onConfirm={() => onConfirmMilestone(milestone.id, milestone.title)}
            />
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Goal library</Text>
        <Text style={styles.mutedCopy}>
          Only one goal can be active in the MVP. Switching focus automatically pauses the previous active goal.
        </Text>
        <ActionButton
          disabled={isBusy}
          label="Create another goal"
          onPress={onCreateAnotherGoal}
          tone="primary"
        />
        {otherGoals.length === 0 ? (
          <Text style={styles.emptyLine}>No other saved goals yet.</Text>
        ) : (
          otherGoals.map((goal) => (
            <GoalRow
              key={goal.id}
              actionLabel={isGoalActivatable(goal) ? "Switch focus" : "Unavailable"}
              disabled={!isGoalActivatable(goal) || isBusy}
              onPress={() => onSwitchGoal(goal.id)}
              summary={createGoalSummary(goal)}
              title={goal.title}
            />
          ))
        )}
      </View>
    </>
  );
}

function DeveloperLab({
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

function HeroPanel({ eyebrow, title, copy, children }) {
  return (
    <View style={styles.heroCard}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroCopy}>{copy}</Text>
      {children}
    </View>
  );
}

function StepRail({ currentStep }) {
  return (
    <View style={styles.stepRail}>
      {[1, 2, 3, 4].map((step) => (
        <View key={step} style={styles.stepRailItem}>
          <View
            style={[
              styles.stepRailDot,
              step <= currentStep ? styles.stepRailDotActive : null
            ]}
          >
            <Text
              style={[
                styles.stepRailDotText,
                step <= currentStep ? styles.stepRailDotTextActive : null
              ]}
            >
              {step}
            </Text>
          </View>
          {step < 4 ? (
            <View
              style={[
                styles.stepRailLine,
                step < currentStep ? styles.stepRailLineActive : null
              ]}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function GoalRow({
  actionLabel,
  compactAction = false,
  disabled = false,
  onPress,
  summary,
  title
}) {
  return (
    <View style={styles.listRow}>
      <View style={styles.listRowCopy}>
        <Text style={styles.listPrimary}>{title}</Text>
        <Text style={styles.listSecondary}>{summary}</Text>
      </View>
      <ActionButton
        compact={compactAction}
        disabled={disabled}
        label={actionLabel}
        onPress={onPress}
        tone={disabled ? "muted" : "secondary"}
      />
    </View>
  );
}

function TaskCard({ disabled, onComplete, onSkip, task }) {
  const state = task.state ?? "pending";
  const isFinished = state === "completed" || state === "skipped";

  return (
    <View style={styles.taskCard}>
      <View style={styles.taskCardHeader}>
        <Text style={styles.taskTitle}>{task.title}</Text>
        <StatusChip label={humanizeToken(state)} tone={state} />
      </View>
      <View style={styles.taskMetaRow}>
        <StatusChip label={`${getTaskMinutes(task)} min`} tone="neutral" />
        <StatusChip label={humanizeToken(task.difficulty)} tone={task.difficulty} />
        {task.required ? <StatusChip label="Required" tone="required" /> : null}
      </View>
      {!isFinished ? (
        <View style={styles.inlineActionRow}>
          <View style={styles.inlineActionItem}>
            <ActionButton disabled={disabled} label="Complete" onPress={onComplete} tone="primary" />
          </View>
          <View style={styles.inlineActionItem}>
            <ActionButton disabled={disabled} label="Skip" onPress={onSkip} tone="ghost" />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function MilestoneRow({ disabled, milestone, onConfirm }) {
  const isPending = milestone.status === "pending";

  return (
    <View style={styles.listRow}>
      <View style={styles.listRowCopy}>
        <Text style={styles.listPrimary}>{milestone.title}</Text>
        <Text style={styles.listSecondary}>
          Week {milestone.target_week} · {humanizeToken(milestone.status)}
        </Text>
        <Text style={styles.listTertiary}>{milestone.success_criteria}</Text>
      </View>
      <ActionButton
        compact
        disabled={disabled || !isPending}
        label={isPending ? "Confirm" : "Done"}
        onPress={onConfirm}
        tone={isPending ? "secondary" : "muted"}
      />
    </View>
  );
}

function MilestonePreviewRow({ milestone }) {
  return (
    <View style={styles.previewRow}>
      <View style={styles.previewWeekBadge}>
        <Text style={styles.previewWeekText}>W{milestone.target_week}</Text>
      </View>
      <View style={styles.previewCopy}>
        <Text style={styles.listPrimary}>{milestone.title}</Text>
        <Text style={styles.listTertiary}>{milestone.success_criteria}</Text>
      </View>
    </View>
  );
}

function TaskPreviewRow({ task }) {
  return (
    <View style={styles.previewRow}>
      <View style={styles.previewWeekBadge}>
        <Text style={styles.previewWeekText}>{getTaskMinutes(task)}m</Text>
      </View>
      <View style={styles.previewCopy}>
        <Text style={styles.listPrimary}>{task.title}</Text>
        <Text style={styles.listTertiary}>
          {humanizeToken(task.difficulty)} · {task.required ? "Required" : "Flexible"}
        </Text>
      </View>
    </View>
  );
}

function HeroBadge({ label, value }) {
  return (
    <View style={styles.heroBadge}>
      <Text style={styles.heroBadgeLabel}>{label}</Text>
      <Text style={styles.heroBadgeValue}>{value}</Text>
    </View>
  );
}

function MetricTile({ label, value }) {
  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricTileLabel}>{label}</Text>
      <Text style={styles.metricTileValue}>{value}</Text>
    </View>
  );
}

function StatusChip({ label, tone }) {
  return (
    <View style={[styles.statusChip, toneStyles[tone] ?? toneStyles.neutral]}>
      <Text style={[styles.statusChipText, toneTextStyles[tone] ?? toneTextStyles.neutral]}>{label}</Text>
    </View>
  );
}

function ActionButton({ compact = false, disabled = false, label, onPress, tone }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonBase,
        toneButtonStyles[tone] ?? toneButtonStyles.secondary,
        compact ? styles.buttonCompact : null,
        disabled ? styles.buttonDisabled : null,
        pressed && !disabled ? styles.buttonPressed : null
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          toneButtonTextStyles[tone] ?? toneButtonTextStyles.secondary,
          disabled ? styles.buttonTextDisabled : null
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ChoicePill({ active, disabled = false, label, onPress }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choicePill,
        active ? styles.choicePillActive : null,
        disabled ? styles.choicePillDisabled : null,
        pressed && !disabled ? styles.buttonPressed : null
      ]}
    >
      <Text style={[styles.choicePillText, active ? styles.choicePillTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function CoachBanner({ message }) {
  return (
    <View style={styles.coachBanner}>
      <Text style={styles.coachBannerText}>{message}</Text>
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

function BusyNotice({ label }) {
  return (
    <View style={styles.busyFooter}>
      <ActivityIndicator size="small" color="#B65C3A" />
      <Text style={styles.busyText}>{label}</Text>
    </View>
  );
}

function BackgroundArt() {
  return (
    <View pointerEvents="none" style={styles.backgroundWrap}>
      <View style={styles.backgroundBlobTop} />
      <View style={styles.backgroundBlobLeft} />
      <View style={styles.backgroundBlobBottom} />
      <View style={styles.backgroundHalo} />
    </View>
  );
}

const headingFont = Platform.select({
  ios: "Avenir Next",
  android: "sans-serif-condensed",
  default: undefined
});

const bodyFont = Platform.select({
  ios: "Avenir Next",
  android: "sans-serif",
  default: undefined
});

const accentFont = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: undefined
});

const toneStyles = {
  neutral: { backgroundColor: "#F2E8D9", borderColor: "#E6D7BE" },
  pending: { backgroundColor: "#F2E8D9", borderColor: "#E6D7BE" },
  completed: { backgroundColor: "#D9F0E2", borderColor: "#B4D7C4" },
  skipped: { backgroundColor: "#F7E3DB", borderColor: "#E5C3B4" },
  low: { backgroundColor: "#DCEEDB", borderColor: "#BDD8BC" },
  medium: { backgroundColor: "#F5E4BC", borderColor: "#E7CC85" },
  high: { backgroundColor: "#F7D7C9", borderColor: "#E7B7A4" },
  generating: { backgroundColor: "#E9E3F7", borderColor: "#CEC2E8" },
  delayed: { backgroundColor: "#FDE6C9", borderColor: "#F1C98A" },
  ready: { backgroundColor: "#D9F0E2", borderColor: "#B4D7C4" },
  failed: { backgroundColor: "#F7D7D0", borderColor: "#E7AEA3" },
  required: { backgroundColor: "#E2EEF8", borderColor: "#BED5EA" }
};

const toneTextStyles = {
  neutral: { color: "#5F5349" },
  pending: { color: "#5F5349" },
  completed: { color: "#2D6950" },
  skipped: { color: "#8A4E38" },
  low: { color: "#35684A" },
  medium: { color: "#7A5A11" },
  high: { color: "#8C4727" },
  generating: { color: "#5D4A84" },
  delayed: { color: "#925E00" },
  ready: { color: "#2D6950" },
  failed: { color: "#8B3E31" },
  required: { color: "#355C7A" }
};

const toneButtonStyles = {
  primary: { backgroundColor: "#B65C3A" },
  secondary: { backgroundColor: "#F1E4D1" },
  ghost: { backgroundColor: "#FFF8EE", borderWidth: 1, borderColor: "#E9DCC9" },
  danger: { backgroundColor: "#8F3E2B" },
  muted: { backgroundColor: "#E9E0D6" }
};

const toneButtonTextStyles = {
  primary: { color: "#FFF7EE" },
  secondary: { color: "#3F342C" },
  ghost: { color: "#7E5A47" },
  danger: { color: "#FFF7EE" },
  muted: { color: "#8A7D70" }
};

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  screen: {
    flex: 1,
    backgroundColor: "#FFF7EE"
  },
  backgroundWrap: {
    ...StyleSheet.absoluteFillObject
  },
  backgroundBlobTop: {
    position: "absolute",
    top: -120,
    right: -40,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#F1C37B"
  },
  backgroundBlobLeft: {
    position: "absolute",
    top: 220,
    left: -110,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "#B8DCC9"
  },
  backgroundBlobBottom: {
    position: "absolute",
    bottom: -110,
    right: -70,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#EFC4B0"
  },
  backgroundHalo: {
    position: "absolute",
    top: 80,
    left: 28,
    right: 28,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.45)"
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    gap: 12
  },
  loadingTitle: {
    color: "#332C27",
    fontFamily: headingFont,
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center"
  },
  loadingCopy: {
    color: "#675C54",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    fontFamily: bodyFont
  },
  welcomeContent: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 34,
    gap: 18,
    minHeight: "100%",
    justifyContent: "center"
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 36,
    gap: 18
  },
  heroCard: {
    backgroundColor: "#26201D",
    borderRadius: 32,
    padding: 24,
    gap: 10,
    shadowColor: "#1A1613",
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6
  },
  eyebrow: {
    color: "#F1C37B",
    fontFamily: accentFont,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 2
  },
  heroTitle: {
    color: "#FFF7EE",
    fontFamily: headingFont,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700"
  },
  heroCopy: {
    color: "#E8DDD2",
    fontFamily: bodyFont,
    fontSize: 15,
    lineHeight: 23
  },
  heroStatRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6
  },
  heroBadge: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,247,238,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,247,238,0.12)"
  },
  heroBadgeLabel: {
    color: "#D8C6B7",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: bodyFont
  },
  heroBadgeValue: {
    color: "#FFF7EE",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
    fontFamily: bodyFont
  },
  card: {
    backgroundColor: "rgba(255, 252, 247, 0.9)",
    borderRadius: 28,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(77, 60, 49, 0.08)"
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 4
  },
  sectionTitle: {
    color: "#332C27",
    fontFamily: headingFont,
    fontSize: 24,
    fontWeight: "700"
  },
  mutedCopy: {
    color: "#6C6057",
    fontFamily: bodyFont,
    fontSize: 14,
    lineHeight: 22
  },
  fieldGroup: {
    gap: 8
  },
  fieldLabel: {
    color: "#554941",
    fontFamily: bodyFont,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  promptText: {
    color: "#332C27",
    fontFamily: bodyFont,
    fontSize: 15,
    lineHeight: 22
  },
  helperLine: {
    color: "#7D6F66",
    fontFamily: bodyFont,
    fontSize: 13,
    lineHeight: 20
  },
  input: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E7D8C5",
    backgroundColor: "#FFF8F1",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#332C27",
    fontFamily: bodyFont,
    fontSize: 15
  },
  multilineInput: {
    minHeight: 126
  },
  noteCard: {
    backgroundColor: "#F8EBDD",
    borderRadius: 20,
    padding: 14,
    gap: 6
  },
  noteTitle: {
    color: "#5E4736",
    fontFamily: accentFont,
    fontSize: 14
  },
  noteCopy: {
    color: "#6B5649",
    fontFamily: bodyFont,
    fontSize: 13,
    lineHeight: 20
  },
  stepRail: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4
  },
  stepRailItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  stepRailDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4E8DA",
    borderWidth: 1,
    borderColor: "#E4D6C5"
  },
  stepRailDotActive: {
    backgroundColor: "#B65C3A",
    borderColor: "#B65C3A"
  },
  stepRailDotText: {
    color: "#6D5D52",
    fontFamily: bodyFont,
    fontSize: 13,
    fontWeight: "700"
  },
  stepRailDotTextActive: {
    color: "#FFF7EE"
  },
  stepRailLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#E6D7C4",
    marginHorizontal: 8
  },
  stepRailLineActive: {
    backgroundColor: "#D58A66"
  },
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  choicePill: {
    maxWidth: "100%",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: "#F6EFE6",
    borderWidth: 1,
    borderColor: "#E8DBCC"
  },
  choicePillActive: {
    backgroundColor: "#26201D",
    borderColor: "#26201D"
  },
  choicePillDisabled: {
    opacity: 0.55
  },
  choicePillText: {
    color: "#4A3F38",
    fontFamily: bodyFont,
    fontSize: 14,
    fontWeight: "700"
  },
  choicePillTextActive: {
    color: "#FFF7EE"
  },
  buttonBase: {
    minHeight: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  buttonCompact: {
    minHeight: 38,
    paddingHorizontal: 14
  },
  buttonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }]
  },
  buttonDisabled: {
    opacity: 0.58
  },
  buttonText: {
    fontFamily: bodyFont,
    fontSize: 15,
    fontWeight: "700"
  },
  buttonTextDisabled: {
    color: "#8C7E71"
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metricTile: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#FFF5E9",
    borderWidth: 1,
    borderColor: "#EADBC8"
  },
  metricTileLabel: {
    color: "#7B6C61",
    fontFamily: bodyFont,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: "uppercase"
  },
  metricTileValue: {
    color: "#332C27",
    fontFamily: headingFont,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
    marginTop: 6
  },
  timelineWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  inlineActionRow: {
    flexDirection: "row",
    gap: 10
  },
  inlineActionItem: {
    flex: 1
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4
  },
  listRowCopy: {
    flex: 1,
    gap: 3
  },
  listPrimary: {
    color: "#332C27",
    fontFamily: bodyFont,
    fontSize: 15,
    fontWeight: "700"
  },
  listSecondary: {
    color: "#6D6057",
    fontFamily: bodyFont,
    fontSize: 13,
    lineHeight: 19
  },
  listTertiary: {
    color: "#7D7067",
    fontFamily: bodyFont,
    fontSize: 12,
    lineHeight: 18
  },
  emptyLine: {
    color: "#6D6057",
    fontFamily: bodyFont,
    fontSize: 14,
    lineHeight: 22
  },
  taskCard: {
    borderRadius: 24,
    padding: 16,
    gap: 12,
    backgroundColor: "#FFF9F2",
    borderWidth: 1,
    borderColor: "#EBDCC9"
  },
  taskCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  taskTitle: {
    flex: 1,
    color: "#332C27",
    fontFamily: bodyFont,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22
  },
  taskMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1
  },
  statusChipText: {
    fontFamily: bodyFont,
    fontSize: 12,
    fontWeight: "700"
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 4
  },
  previewWeekBadge: {
    width: 48,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#F8EBDD",
    alignItems: "center",
    justifyContent: "center"
  },
  previewWeekText: {
    color: "#7A5B47",
    fontFamily: headingFont,
    fontSize: 14,
    fontWeight: "700"
  },
  previewCopy: {
    flex: 1,
    gap: 4
  },
  progressBarTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: "#F2E5D7",
    overflow: "hidden"
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#B65C3A"
  },
  coachBanner: {
    backgroundColor: "#F8EBDD",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#ECD7BE"
  },
  coachBannerText: {
    color: "#5D4B3E",
    fontFamily: bodyFont,
    fontSize: 14,
    lineHeight: 20
  },
  errorBanner: {
    backgroundColor: "#FCE2D9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#EDC0B0"
  },
  errorText: {
    color: "#8A3D28",
    fontFamily: bodyFont,
    fontSize: 14,
    lineHeight: 20
  },
  busyFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: 4
  },
  busyText: {
    color: "#5D4B3E",
    fontFamily: bodyFont,
    fontSize: 14,
    fontWeight: "700"
  }
});
