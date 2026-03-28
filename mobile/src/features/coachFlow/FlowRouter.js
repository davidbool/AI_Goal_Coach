import { getFlowSurface } from "./model.js";
import { GoalStudioScreen } from "./screens/GoalStudioScreen.js";
import { ClarificationScreen } from "./screens/ClarificationScreen.js";
import { AssessmentScreen } from "./screens/AssessmentScreen.js";
import { GeneratingScreen } from "./screens/GeneratingScreen.js";
import { PlanReadyScreen } from "./screens/PlanReadyScreen.js";
import { GenerationFailedScreen } from "./screens/GenerationFailedScreen.js";
import { DashboardScreen } from "./screens/DashboardScreen.js";

export function FlowRouter({
  composer,
  editingTaskId,
  notificationDirty,
  notificationDraft,
  snapshot,
  taskEditDraft,
  isBusy,
  onActivateGoal,
  onAdaptUpcomingDays,
  onBuildPlan,
  onCancelComposer,
  onCancelTaskEdit,
  onChangeAssessment,
  onChangeGoalTitle,
  onChangeNotificationField,
  onChangeTaskEditField,
  onClarificationChange,
  onBeginTaskEdit,
  onCompleteTask,
  onConfirmMilestone,
  onCreateGoal,
  onCreateAnotherGoal,
  onRefreshGenerationStatus,
  onRefreshSnapshot,
  onRetryGeneration,
  onSaveNotifications,
  onSaveTaskEdit,
  onSelectGoalPrompt,
  onSelectNotificationMaxPush,
  onSkipTask,
  onSoftAdjust,
  onSubmitClarifications,
  onSwitchGoal
}) {
  const surface = getFlowSurface(snapshot, composer);

  if (surface === "goal_studio") {
    return (
      <GoalStudioScreen
        composer={composer}
        existingGoals={snapshot.goals.filter((goal) => goal.id !== snapshot.activeGoal?.id)}
        hasActiveGoal={Boolean(snapshot.activeGoal)}
        isBusy={isBusy}
        onActivateGoal={onActivateGoal}
        onCancel={onCancelComposer}
        onChangeGoalTitle={onChangeGoalTitle}
        onCreateGoal={onCreateGoal}
        onSelectGoalPrompt={onSelectGoalPrompt}
      />
    );
  }

  if (surface === "clarify") {
    return (
      <ClarificationScreen
        composer={composer}
        isBusy={isBusy}
        onCancel={onCancelComposer}
        onChangeAnswer={onClarificationChange}
        onSubmit={onSubmitClarifications}
      />
    );
  }

  if (surface === "assessment") {
    return (
      <AssessmentScreen
        composer={composer}
        isBusy={isBusy}
        onBuildPlan={onBuildPlan}
        onCancel={onCancelComposer}
        onChangeAssessment={onChangeAssessment}
      />
    );
  }

  if (surface === "generating") {
    return (
      <GeneratingScreen
        composer={composer}
        isBusy={isBusy}
        onCancel={onCancelComposer}
        onRefreshStatus={onRefreshGenerationStatus}
      />
    );
  }

  if (surface === "plan_ready") {
    return (
      <PlanReadyScreen
        composer={composer}
        isBusy={isBusy}
        onActivate={() => onActivateGoal(composer.goalId)}
        onBackToGoals={onCancelComposer}
      />
    );
  }

  if (surface === "generation_failed") {
    return (
      <GenerationFailedScreen
        composer={composer}
        isBusy={isBusy}
        onBack={onCancelComposer}
        onRetry={onRetryGeneration}
      />
    );
  }

  return (
    <DashboardScreen
      activeGoal={snapshot.activeGoal}
      editingTaskId={editingTaskId}
      goals={snapshot.goals}
      isBusy={isBusy}
      localDateKey={snapshot.localDateKey}
      notificationDirty={notificationDirty}
      notificationDraft={notificationDraft}
      notifications={snapshot.notifications}
      progress={snapshot.progress}
      taskEditDraft={taskEditDraft}
      today={snapshot.today}
      onAdaptUpcomingDays={onAdaptUpcomingDays}
      onBeginTaskEdit={onBeginTaskEdit}
      onCancelTaskEdit={onCancelTaskEdit}
      onChangeNotificationField={onChangeNotificationField}
      onChangeTaskEditField={onChangeTaskEditField}
      onCompleteTask={onCompleteTask}
      onConfirmMilestone={onConfirmMilestone}
      onCreateAnotherGoal={onCreateAnotherGoal}
      onRefresh={onRefreshSnapshot}
      onSaveNotifications={onSaveNotifications}
      onSaveTaskEdit={onSaveTaskEdit}
      onSelectNotificationMaxPush={onSelectNotificationMaxPush}
      onSkipTask={onSkipTask}
      onSoftAdjust={onSoftAdjust}
      onSwitchGoal={onSwitchGoal}
    />
  );
}
