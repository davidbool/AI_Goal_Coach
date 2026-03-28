import { PlanState, SpecificityState } from "../contracts/constants.js";
import { GeneratedPlanPayloadSchema } from "../contracts/schemas.js";
import { conflict } from "../contracts/validators.js";
import { generateId, nowIso } from "../repositories/storeUtils.js";

export class PlanService {
  constructor({ store, goalService, aiClient, clock = Date }) {
    this.store = store;
    this.goalService = goalService;
    this.aiClient = aiClient;
    this.clock = clock;
    this.delayThresholdMs = 350;
  }

  async triggerGeneration(goalId) {
    const goal = await this.goalService.getGoal(goalId);
    const assessment = await this.goalService.getAssessment(goalId);

    if (goal.specificity_state !== SpecificityState.SPECIFIC) {
      throw conflict("Goal must be specific before plan generation");
    }

    if (!assessment) {
      throw conflict("Onboarding assessment is required before plan generation");
    }

    const existingJob = await this.store.getPlanJob(goalId);
    if (existingJob && !existingJob.completed_at) {
      return {
        goal_id: goal.id,
        plan_state: goal.plan_state,
        started_at: existingJob.started_at,
        delayed_after_ms: this.delayThresholdMs
      };
    }

    const frameType = this.aiClient.classifyFrame(goal.title);
    const clarifications = await this.goalService.getClarifications(goal.id);

    const draft = this.aiClient.generatePlanDraft({
      goalText: goal.title,
      clarificationAnswers: clarifications.map((row) => row.answer_text),
      assessment,
      frameType
    });

    const now = new this.clock();
    const job = {
      id: generateId("plan_job"),
      goal_id: goal.id,
      started_at: now.toISOString(),
      ready_at: new this.clock(now.getTime() + draft.resolve_ms).toISOString(),
      delayed_at: new this.clock(now.getTime() + this.delayThresholdMs).toISOString(),
      outcome: draft.outcome,
      payload: draft.payload,
      completed_at: null
    };

    await this.store.savePlanJob(goal.id, job);

    goal.plan_state = PlanState.GENERATING;
    goal.updated_at = nowIso(this.clock);
    await this.store.updateGoal(goal.id, {
      plan_state: goal.plan_state,
      updated_at: goal.updated_at
    });

    return {
      goal_id: goal.id,
      plan_state: goal.plan_state,
      started_at: job.started_at,
      delayed_after_ms: this.delayThresholdMs
    };
  }

  async getStatus(goalId) {
    const goal = await this.goalService.getGoal(goalId);
    const job = await this.store.getPlanJob(goal.id);

    if (!job) {
      const latest = await this.getLatestPlan(goal.id);
      return {
        goal_id: goal.id,
        plan_state: goal.plan_state ?? null,
        plan: latest ? this.planDisplay(latest) : null
      };
    }

    const now = new this.clock();
    const delayedAt = new Date(job.delayed_at);
    const readyAt = new Date(job.ready_at);

    if (!job.completed_at && now >= delayedAt && now < readyAt) {
      goal.plan_state = PlanState.DELAYED;
      goal.updated_at = nowIso(this.clock);
      await this.store.updateGoal(goal.id, {
        plan_state: goal.plan_state,
        updated_at: goal.updated_at
      });
    }

    if (!job.completed_at && now >= readyAt) {
      if (job.outcome === "failed") {
        goal.plan_state = PlanState.FAILED;
        goal.updated_at = nowIso(this.clock);
        await this.store.updateGoal(goal.id, {
          plan_state: goal.plan_state,
          updated_at: goal.updated_at
        });
        await this.store.updatePlanJob(goal.id, {
          completed_at: nowIso(this.clock)
        });
      } else {
        const validatedPayload = GeneratedPlanPayloadSchema.safeParse(job.payload);

        if (!validatedPayload.success) {
          goal.plan_state = PlanState.FAILED;
          goal.updated_at = nowIso(this.clock);
          await this.store.updateGoal(goal.id, {
            plan_state: goal.plan_state,
            updated_at: goal.updated_at
          });
          await this.store.updatePlanJob(goal.id, {
            completed_at: nowIso(this.clock)
          });

          return {
            goal_id: goal.id,
            plan_state: goal.plan_state,
            plan: null
          };
        }

        const plan = await this.persistPlan(goal.id, validatedPayload.data);
        goal.plan_state = PlanState.READY;
        goal.updated_at = nowIso(this.clock);
        await this.store.updateGoal(goal.id, {
          plan_state: goal.plan_state,
          updated_at: goal.updated_at
        });
        await this.store.updatePlanJob(goal.id, {
          completed_at: nowIso(this.clock)
        });

        return {
          goal_id: goal.id,
          plan_state: goal.plan_state,
          plan: this.planDisplay(plan)
        };
      }
    }

    const latest = await this.getLatestPlan(goal.id);

    return {
      goal_id: goal.id,
      plan_state: goal.plan_state,
      plan: latest ? this.planDisplay(latest) : null
    };
  }

  async persistPlan(goalId, payload) {
    if (typeof this.store.persistGeneratedPlan === "function") {
      return this.store.persistGeneratedPlan(goalId, payload, this.clock);
    }

    return {
      id: generateId("plan"),
      goal_id: goalId,
      version: 1,
      frame_type: payload.frame_type,
      feasibility: payload.feasibility,
      estimate: payload.estimate,
      milestones: payload.milestones,
      tasks: payload.tasks,
      created_at: nowIso(this.clock)
    };
  }

  async getLatestPlan(goalId) {
    if (typeof this.store.getLatestPlan === "function") {
      return this.store.getLatestPlan(goalId);
    }

    return null;
  }

  planDisplay(plan) {
    return {
      plan_id: plan.id,
      version: plan.version,
      frame_type: plan.frame_type,
      feasibility: plan.feasibility,
      estimate: plan.estimate,
      milestones: plan.milestones,
      first_tasks: plan.tasks.slice(0, 3)
    };
  }
}
