import { useEffect, useState } from "react";
import { Alert, SafeAreaView } from "react-native";
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
} from "./src/api/goalCoachApi.js";
import {
  clearGuestSession,
  createGuestSession,
  DEFAULT_API_BASE_URL,
  readGuestSession,
  writeGuestSession
} from "./src/storage/guestSession.js";
import { FlowRouter } from "./src/features/coachFlow/FlowRouter.js";
import {
  createEmptyComposer,
  createEmptySnapshot,
  createGenerationComposerState,
  normalizeBootstrap,
  sleep,
  syncComposerWithPlanStatus,
  toClarificationFields
} from "./src/features/coachFlow/model.js";
import { DeveloperLab } from "./src/features/coachFlow/screens/DeveloperLab.js";
import { WelcomeScreen } from "./src/features/coachFlow/screens/WelcomeScreen.js";
import {
  BackgroundArt,
  LoadingScreen,
  SessionScroll
} from "./src/features/coachFlow/components/Primitives.js";
import { styles } from "./src/ui/styles.js";

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
    setSnapshot(normalizeBootstrap(bootstrap));
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
      setCoachMessage(`Loaded "${payload.scenario.replace(/_/g, " ")}" so we can design against a stable state.`);
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
    setComposer((current) => syncComposerWithPlanStatus(current, status));
  }

  async function runPlanGeneration(goalId) {
    const initialGeneration = await generatePlan(
      session.apiBaseUrl,
      session.userId,
      goalId,
      generationScenario
    );

    setComposer((current) =>
      createGenerationComposerState(current, goalId, initialGeneration.plan_state)
    );

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

    if (!Number.isFinite(weeklyMinutes) || weeklyMinutes < 30 || weeklyMinutes > 1260) {
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
        <LoadingScreen
          title="Opening your coaching space"
          copy="Checking this device for a saved guest session."
        />
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
          <FlowRouter
            composer={composer}
            snapshot={snapshot}
            isBusy={isBusy}
            onActivateGoal={handleActivateGoal}
            onBuildPlan={handleBuildPlan}
            onCancelComposer={handleCancelComposer}
            onChangeAssessment={handleAssessmentChange}
            onChangeGoalTitle={handleChangeGoalTitle}
            onClarificationChange={handleClarificationChange}
            onCompleteTask={handleCompleteTask}
            onConfirmMilestone={handleConfirmMilestone}
            onCreateAnotherGoal={handleStartNewGoal}
            onCreateGoal={handleCreateGoal}
            onRefreshGenerationStatus={handleRefreshGenerationStatus}
            onRefreshSnapshot={handleRefreshSnapshot}
            onRetryGeneration={handleRetryGeneration}
            onSelectGoalPrompt={handleSelectGoalPrompt}
            onSkipTask={handleSkipTask}
            onSoftAdjust={handleSoftAdjust}
            onSubmitClarifications={handleSubmitClarifications}
            onSwitchGoal={handleActivateGoal}
          />
          <DeveloperLab {...commonDevLabProps} />
        </SessionScroll>
      )}
    </SafeAreaView>
  );
}
