import { useEffect, useRef, useState } from "react";
import { Alert, SafeAreaView } from "react-native";
import { StatusBar } from "expo-status-bar";

import {
  activateGoal,
  bootstrapDemoSession,
  completeTask,
  confirmMilestone,
  createGoal,
  editTask,
  fetchAppBootstrap,
  fetchPlanStatus,
  generatePlan,
  resetDemoSession,
  skipTask,
  softAdjustActiveGoal,
  triggerFullAdaptation,
  updateNotificationPreferences,
  submitAssessment,
  submitClarifications
} from "./src/api/goalCoachApi.js";
import {
  clearAppSession,
  createFirebaseSession,
  createGuestSession,
  DEFAULT_API_BASE_URL,
  isFirebaseSession,
  readAppSession,
  writeAppSession
} from "./src/storage/appSession.js";
import { FlowRouter } from "./src/features/coachFlow/FlowRouter.js";
import {
  buildNotificationPreferencesPayload,
  buildTaskEditPayload,
  createNotificationDraft,
  createEmptyComposer,
  createEmptySnapshot,
  createEmptyTaskEditDraft,
  createGenerationComposerState,
  createTaskEditDraft,
  notificationDraftMatchesSettings,
  normalizeBootstrap,
  sleep,
  syncComposerWithPlanStatus,
  toClarificationFields,
  validateNotificationDraft,
  validateTaskEditDraft
} from "./src/features/coachFlow/model.js";
import { syncPushTokenRegistration } from "./src/services/pushTokenService.js";
import { isFirebaseConfigured } from "./src/services/firebaseApp.js";
import {
  getCurrentFirebaseIdToken,
  registerWithEmailAndPassword,
  signInWithEmailPassword,
  signOutFromFirebase,
  waitForFirebaseAuthRestore
} from "./src/services/firebaseAuthService.js";
import { DeveloperLab } from "./src/features/coachFlow/screens/DeveloperLab.js";
import { WelcomeScreen } from "./src/features/coachFlow/screens/WelcomeScreen.js";
import {
  BackgroundArt,
  LoadingScreen,
  SessionScroll
} from "./src/features/coachFlow/components/Primitives.js";
import { styles } from "./src/ui/styles.js";

function createEmptyAuthDraft() {
  return {
    email: "",
    password: "",
    confirmPassword: ""
  };
}

export default function App() {
  const [hydrating, setHydrating] = useState(true);
  const [session, setSession] = useState(null);
  const [apiBaseUrlDraft, setApiBaseUrlDraft] = useState(DEFAULT_API_BASE_URL);
  const [authMode, setAuthMode] = useState("sign_up");
  const [authDraft, setAuthDraft] = useState(createEmptyAuthDraft());
  const [busyLabel, setBusyLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [coachMessage, setCoachMessage] = useState("");
  const [devSessionInfo, setDevSessionInfo] = useState(null);
  const [snapshot, setSnapshot] = useState(createEmptySnapshot());
  const [notificationDraft, setNotificationDraft] = useState(createNotificationDraft());
  const [notificationDirty, setNotificationDirty] = useState(false);
  const [pushStatusMessage, setPushStatusMessage] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskEditDraft, setTaskEditDraft] = useState(createEmptyTaskEditDraft());
  const [composer, setComposer] = useState(createEmptyComposer());
  const [generationScenario, setGenerationScenario] = useState("ready");
  const [dashboardSurface, setDashboardSurface] = useState("today");
  const [devLabOpen, setDevLabOpen] = useState(false);
  const notificationDirtyRef = useRef(false);

  function setNotificationDirtyState(value) {
    notificationDirtyRef.current = value;
    setNotificationDirty(value);
  }

  function syncNotificationDraft(nextNotifications) {
    setNotificationDraft(createNotificationDraft(nextNotifications));
    setNotificationDirtyState(false);
  }

  function resetTaskEditing() {
    setEditingTaskId(null);
    setTaskEditDraft(createEmptyTaskEditDraft());
  }

  function getSessionAuth(activeSession = session) {
    if (!activeSession) {
      return null;
    }

    if (isFirebaseSession(activeSession)) {
      return {
        getAuthorizationValue: async () => getCurrentFirebaseIdToken()
      };
    }

    return activeSession.userId;
  }

  function resetExperienceState(nextApiBaseUrl = DEFAULT_API_BASE_URL) {
    setSession(null);
    setApiBaseUrlDraft(nextApiBaseUrl);
    setDevSessionInfo(null);
    setSnapshot(createEmptySnapshot());
    setGenerationScenario("ready");
    setDashboardSurface("today");
    resetComposer("");
    syncNotificationDraft();
    resetTaskEditing();
    setAuthDraft(createEmptyAuthDraft());
    setBusyLabel("");
    setErrorMessage("");
    setCoachMessage("");
    setPushStatusMessage("");
    setDevLabOpen(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const storedSession = await readAppSession();
        const resolvedApiBaseUrl = storedSession?.apiBaseUrl ?? DEFAULT_API_BASE_URL;

        if (cancelled) {
          return;
        }

        setApiBaseUrlDraft(resolvedApiBaseUrl);

        let restoredSession = null;

        if (isFirebaseConfigured()) {
          try {
            const restoredUser = await waitForFirebaseAuthRestore();

            if (restoredUser) {
              restoredSession = createFirebaseSession(restoredUser, resolvedApiBaseUrl);
            }
          } catch (error) {
            if (storedSession?.kind === "firebase") {
              throw error;
            }
          }
        }

        if (!restoredSession && storedSession?.kind === "firebase") {
          await clearAppSession();
        }

        if (!restoredSession && storedSession?.kind === "guest") {
          restoredSession = storedSession;
        }

        if (!restoredSession) {
          return;
        }

        await writeAppSession(restoredSession);
        setSession(restoredSession);
        const normalized = await loadSnapshot(restoredSession, { rehydrateNotifications: true });
        await syncPushToken(restoredSession, {
          hasPushToken: normalized?.notifications?.hasPushToken,
          promptForPermission: false
        });

        if (isFirebaseSession(restoredSession)) {
          setCoachMessage(
            restoredSession.email
              ? `Welcome back, ${restoredSession.email}.`
              : "Welcome back. Your coaching space is ready."
          );
        }
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

  async function loadSnapshot(activeSession = session, options = {}) {
    if (!activeSession) {
      return null;
    }

    const { rehydrateNotifications = false } = options;
    const bootstrap = await fetchAppBootstrap(activeSession.apiBaseUrl, getSessionAuth(activeSession));
    const normalized = normalizeBootstrap(bootstrap);

    setSnapshot(normalized);

    if (normalized.notifications?.hasPushToken) {
      setPushStatusMessage("");
    }

    const editingTaskStillPending = normalized.today?.tasks?.some(
      (task) => task.id === editingTaskId && task.state === "pending"
    );

    if (editingTaskId && !editingTaskStillPending) {
      resetTaskEditing();
    }

    if (rehydrateNotifications || !notificationDirtyRef.current) {
      syncNotificationDraft(normalized.notifications);
    }

    return normalized;
  }

  async function syncPushToken(activeSession = session, options = {}) {
    if (!activeSession) {
      return null;
    }

    const result = await syncPushTokenRegistration({
      apiBaseUrl: activeSession.apiBaseUrl,
      authContext: getSessionAuth(activeSession),
      hasPushToken: options.hasPushToken ?? snapshot.notifications?.hasPushToken ?? false,
      promptForPermission: options.promptForPermission ?? false
    });

    if (result.outcome === "registered") {
      await loadSnapshot(activeSession, { rehydrateNotifications: true });

      if (options.showMessage) {
        setCoachMessage("Push is configured for this device, and reminder delivery can use the saved token.");
      }

      return result;
    }

    if (options.showMessage && result.message) {
      setPushStatusMessage(result.message);
    }

    return result;
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

  function handleChangeAuthField(field, value) {
    setErrorMessage("");
    setAuthDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  async function handleAuthenticate() {
    if (!isFirebaseConfigured()) {
      setErrorMessage("Firebase is not configured yet on this device.");
      return;
    }

    const email = authDraft.email.trim().toLowerCase();
    const password = authDraft.password;

    if (!email || !email.includes("@")) {
      setErrorMessage("Enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    if (authMode === "sign_up" && password !== authDraft.confirmPassword) {
      setErrorMessage("Password confirmation must match.");
      return;
    }

    await runBusyAction(authMode === "sign_up" ? "Creating your account" : "Signing you in", async () => {
      const user =
        authMode === "sign_up"
          ? await registerWithEmailAndPassword(email, password)
          : await signInWithEmailPassword(email, password);

      const nextSession = createFirebaseSession(user, apiBaseUrlDraft.trim() || DEFAULT_API_BASE_URL);

      await writeAppSession(nextSession);
      setSession(nextSession);
      setApiBaseUrlDraft(nextSession.apiBaseUrl);
      setAuthDraft(createEmptyAuthDraft());
      setDashboardSurface("today");
      resetTaskEditing();
      resetComposer("");
      setDevSessionInfo(null);
      setCoachMessage(
        authMode === "sign_up"
          ? "Account created. Let's shape the first goal worth acting on."
          : "Welcome back. Your coaching space is ready."
      );

      const normalized = await loadSnapshot(nextSession, { rehydrateNotifications: true });
      await syncPushToken(nextSession, {
        hasPushToken: normalized?.notifications?.hasPushToken,
        promptForPermission: false
      });
    });
  }

  async function handleContinueAsGuest() {
    await runBusyAction("Preparing your guest coach", async () => {
      const nextSession = createGuestSession(apiBaseUrlDraft.trim() || DEFAULT_API_BASE_URL);

      await writeAppSession(nextSession);
      setSession(nextSession);
      setApiBaseUrlDraft(nextSession.apiBaseUrl);

      const seededSession = await bootstrapDemoSession(
        nextSession.apiBaseUrl,
        getSessionAuth(nextSession),
        "starter"
      );

      setDevSessionInfo(seededSession);
      setDashboardSurface("today");
      setCoachMessage("Your local guest workspace is ready. Let's define one goal worth acting on.");
      resetComposer("");
      const normalized = await loadSnapshot(nextSession, { rehydrateNotifications: true });
      await syncPushToken(nextSession, {
        hasPushToken: normalized?.notifications?.hasPushToken,
        promptForPermission: false
      });
    });
  }

  async function handleSaveApiBaseUrl() {
    await runBusyAction("Saving API base URL", async () => {
      const nextApiBaseUrl = apiBaseUrlDraft.trim() || DEFAULT_API_BASE_URL;

      if (!session) {
        setApiBaseUrlDraft(nextApiBaseUrl);
        return;
      }

      const nextSession = {
        ...session,
        apiBaseUrl: nextApiBaseUrl
      };

      await writeAppSession(nextSession);
      setSession(nextSession);
      setCoachMessage("Saved. Future requests will use the updated API address.");
      const normalized = await loadSnapshot(nextSession, { rehydrateNotifications: true });
      await syncPushToken(nextSession, {
        hasPushToken: normalized?.notifications?.hasPushToken,
        promptForPermission: false
      });
    });
  }

  function handleStartOver() {
    const hasFirebaseSession = isFirebaseSession(session);

    Alert.alert(
      hasFirebaseSession ? "Sign out?" : "Start over?",
      hasFirebaseSession
        ? "This signs you out on this device and brings the app back to the authentication screen."
        : "This clears the local guest session and resets the mobile app back to its first screen.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: hasFirebaseSession ? "Sign out" : "Start over",
          style: "destructive",
          onPress: async () => {
            if (hasFirebaseSession) {
              await signOutFromFirebase();
            }

            const nextApiBaseUrl = session?.apiBaseUrl ?? apiBaseUrlDraft;
            await clearAppSession();
            resetExperienceState(nextApiBaseUrl || DEFAULT_API_BASE_URL);
            setAuthMode("sign_in");
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
          ? await resetDemoSession(session.apiBaseUrl, getSessionAuth(session))
          : await bootstrapDemoSession(session.apiBaseUrl, getSessionAuth(session), scenario);

      setDevSessionInfo(payload);
      setDashboardSurface("today");
      setCoachMessage(`Loaded "${payload.scenario.replace(/_/g, " ")}" so we can design against a stable state.`);
      resetTaskEditing();
      resetComposer("");
      await loadSnapshot(session, { rehydrateNotifications: true });
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
    setDashboardSurface("today");
    resetTaskEditing();
    setComposer((current) => ({
      ...createEmptyComposer(),
      title: current.title,
      stage: "intake"
    }));
  }

  function handleCancelComposer() {
    setCoachMessage("No rush. We can come back to this goal whenever you want.");
    setErrorMessage("");
    setDashboardSurface("today");
    resetComposer("");
  }

  function handleChangeNotificationField(field, value) {
    setErrorMessage("");
    setNotificationDraft((current) => {
      const nextDraft = {
        ...current,
        [field]: value
      };

      setNotificationDirtyState(!notificationDraftMatchesSettings(nextDraft, snapshot.notifications));
      return nextDraft;
    });
  }

  function handleSelectNotificationMaxPush(maxPushPerDay) {
    setErrorMessage("");
    setNotificationDraft((current) => {
      const nextDraft = {
        ...current,
        maxPushPerDay
      };

      setNotificationDirtyState(!notificationDraftMatchesSettings(nextDraft, snapshot.notifications));
      return nextDraft;
    });
  }

  function handleStartTaskEditing(task) {
    setErrorMessage("");
    setEditingTaskId(task.id);
    setTaskEditDraft(createTaskEditDraft(task));
  }

  function handleChangeTaskEditField(field, value) {
    setErrorMessage("");
    setTaskEditDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleCancelTaskEditing() {
    setErrorMessage("");
    resetTaskEditing();
  }

  async function handleSaveNotifications() {
    if (!session) {
      return;
    }

    const validationError = validateNotificationDraft(notificationDraft);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    await runBusyAction("Saving reminder settings", async () => {
      await updateNotificationPreferences(
        session.apiBaseUrl,
        getSessionAuth(session),
        buildNotificationPreferencesPayload(notificationDraft)
      );
      await loadSnapshot(session, { rehydrateNotifications: true });
      setCoachMessage("Reminders saved. The dashboard is back in sync with your latest schedule.");
    });
  }

  async function handleRegisterPushToken() {
    if (!session) {
      return;
    }

    await runBusyAction("Registering this device for push", async () => {
      setPushStatusMessage("");
      await syncPushToken(session, {
        promptForPermission: true,
        showMessage: true
      });
    });
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
      const authContext = getSessionAuth(session);
      const createdGoal = await createGoal(session.apiBaseUrl, authContext, nextTitle);
      const needsClarification = createdGoal.specificity?.state === "needs_clarification";

      setComposer((current) => ({
        ...current,
        stage: needsClarification ? "clarify" : "assessment",
        goalId: createdGoal.goal.id,
        title: createdGoal.goal.title,
        specificity: createdGoal.specificity ?? null,
        clarificationFields: needsClarification
          ? toClarificationFields(createdGoal.specificity?.clarification_questions ?? [])
          : [],
        planState: createdGoal.goal.plan_state ?? "idle",
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
        getSessionAuth(session),
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
      getSessionAuth(session),
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
      const status = await fetchPlanStatus(session.apiBaseUrl, getSessionAuth(session), goalId);

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
      const authContext = getSessionAuth(session);
      await submitAssessment(session.apiBaseUrl, authContext, composer.goalId, {
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
      const status = await fetchPlanStatus(session.apiBaseUrl, getSessionAuth(session), composer.goalId);
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
      const authContext = getSessionAuth(session);
      await activateGoal(session.apiBaseUrl, authContext, goalId);
      await loadSnapshot(session);
      setDashboardSurface("today");
      resetTaskEditing();
      setCoachMessage("Your focus has been switched. Today's dashboard is refreshed for the active goal.");
      resetComposer("");
    });
  }

  async function handleCompleteTask(taskId, taskTitle) {
    if (!session) {
      return;
    }

    await runBusyAction("Marking task complete", async () => {
      await completeTask(session.apiBaseUrl, getSessionAuth(session), taskId, {});
      await loadSnapshot(session);
      setCoachMessage(`Nice work. "${taskTitle}" is complete and the dashboard is back in sync.`);
    });
  }

  async function handleCompleteToday() {
    if (!session) {
      return;
    }

    const pendingTasks = (snapshot.today?.tasks ?? []).filter((task) => task.state === "pending");

    if (pendingTasks.length === 0) {
      setCoachMessage("Today is already wrapped. You can review progress whenever you want.");
      return;
    }

    await runBusyAction("Completing today", async () => {
      for (const task of pendingTasks) {
        await completeTask(session.apiBaseUrl, getSessionAuth(session), task.id, {});
      }

      await loadSnapshot(session);
      resetTaskEditing();
      setCoachMessage("Beautiful. Today's remaining tasks are complete and your momentum is updated.");
    });
  }

  async function handleSkipTask(taskId) {
    if (!session) {
      return;
    }

    await runBusyAction("Skipping task", async () => {
      await skipTask(session.apiBaseUrl, getSessionAuth(session), taskId, {});
      await loadSnapshot(session);
      setCoachMessage("Skipped tasks are still signal, not failure. The dashboard is refreshed and ready for the next move.");
    });
  }

  async function handleSaveTaskEditing(taskId) {
    if (!session || editingTaskId !== taskId) {
      return;
    }

    const validationError = validateTaskEditDraft(taskEditDraft);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    await runBusyAction("Saving task edits", async () => {
      const result = await editTask(
        session.apiBaseUrl,
        getSessionAuth(session),
        taskId,
        buildTaskEditPayload(taskEditDraft)
      );
      await loadSnapshot(session);
      resetTaskEditing();
      setCoachMessage(
        `Saved changes to "${result.task.title}". It is now preserved during future adaptation.`
      );
    });
  }

  async function handleSoftAdjust() {
    if (!session) {
      return;
    }

    await runBusyAction("Lightening today's plan", async () => {
      const adjusted = await softAdjustActiveGoal(session.apiBaseUrl, getSessionAuth(session));
      await loadSnapshot(session);
      resetTaskEditing();
      setCoachMessage(
        adjusted.feedback ?? "Today's remaining tasks were softened without changing your plan version."
      );
    });
  }

  async function handleAdaptUpcomingDays() {
    if (!session) {
      return;
    }

    await runBusyAction("Adapting upcoming days", async () => {
      const authContext = getSessionAuth(session);
      const adapted = await triggerFullAdaptation(session.apiBaseUrl, authContext, {
        triggered_by: "manual"
      });
      await loadSnapshot(session);
      resetTaskEditing();
      setCoachMessage(
        `Upcoming days adapted. Plan v${adapted.new_plan_version} is ready, and locked tasks stayed preserved.`
      );
    });
  }

  async function handleConfirmMilestone(milestoneId, title) {
    if (!session) {
      return;
    }

    await runBusyAction("Confirming milestone", async () => {
      await confirmMilestone(session.apiBaseUrl, getSessionAuth(session), milestoneId);
      await loadSnapshot(session);
      setCoachMessage(`Milestone confirmed: "${title}". Progress is refreshed.`);
    });
  }

  function handleShowToday() {
    setDashboardSurface("today");
  }

  function handleShowProgress() {
    setDashboardSurface("progress");
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
          copy="Checking this device for a saved account or preview session."
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
          authDraft={authDraft}
          authMode={authMode}
          busyLabel={busyLabel}
          errorMessage={errorMessage}
          onChangeApiBaseUrl={setApiBaseUrlDraft}
          onChangeAuthField={handleChangeAuthField}
          onContinueAsGuest={handleContinueAsGuest}
          onSelectAuthMode={setAuthMode}
          onSubmitAuth={handleAuthenticate}
        />
      ) : (
        <SessionScroll
          busyLabel={busyLabel}
          coachMessage={coachMessage}
          errorMessage={errorMessage}
        >
          <FlowRouter
            composer={composer}
            dashboardSurface={dashboardSurface}
            editingTaskId={editingTaskId}
            notificationDirty={notificationDirty}
            notificationDraft={notificationDraft}
            pushStatusMessage={pushStatusMessage}
            snapshot={snapshot}
            taskEditDraft={taskEditDraft}
            isBusy={isBusy}
            onActivateGoal={handleActivateGoal}
            onAdaptUpcomingDays={handleAdaptUpcomingDays}
            onBuildPlan={handleBuildPlan}
            onCancelComposer={handleCancelComposer}
            onCancelTaskEdit={handleCancelTaskEditing}
            onChangeAssessment={handleAssessmentChange}
            onChangeGoalTitle={handleChangeGoalTitle}
            onChangeNotificationField={handleChangeNotificationField}
            onChangeTaskEditField={handleChangeTaskEditField}
            onClarificationChange={handleClarificationChange}
            onBeginTaskEdit={handleStartTaskEditing}
            onCompleteTask={handleCompleteTask}
            onCompleteToday={handleCompleteToday}
            onConfirmMilestone={handleConfirmMilestone}
            onCreateAnotherGoal={handleStartNewGoal}
            onCreateGoal={handleCreateGoal}
            onRefreshGenerationStatus={handleRefreshGenerationStatus}
            onRefreshSnapshot={handleRefreshSnapshot}
            onRegisterPushToken={handleRegisterPushToken}
            onRetryGeneration={handleRetryGeneration}
            onSaveNotifications={handleSaveNotifications}
            onSaveTaskEdit={handleSaveTaskEditing}
            onSelectGoalPrompt={handleSelectGoalPrompt}
            onSelectNotificationMaxPush={handleSelectNotificationMaxPush}
            onShowProgress={handleShowProgress}
            onShowToday={handleShowToday}
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
