import express from "express";
import { createInMemoryStore } from "./repositories/inMemoryStore.js";
import { MockAiClient } from "./services/mockAiClient.js";
import { GoalSpecificityService } from "./services/goalSpecificityService.js";
import { GoalService } from "./services/goalService.js";
import { PlanService } from "./services/planService.js";
import { badRequest } from "./contracts/validators.js";

export function createApp(overrides = {}) {
  const store = overrides.store ?? createInMemoryStore();
  const aiClient = overrides.aiClient ?? new MockAiClient();
  const clock = overrides.clock ?? Date;

  const specificityService =
    overrides.specificityService ?? new GoalSpecificityService({ aiClient });

  const goalService =
    overrides.goalService ?? new GoalService({ store, specificityService, clock });

  const planService =
    overrides.planService ?? new PlanService({ store, goalService, aiClient, clock });

  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.post("/v1/goals", (req, res, next) => {
    try {
      const body = req.body ?? {};
      const payload = {
        user_id: body.user_id ?? "demo-user",
        title: body.title
      };

      const result = goalService.createGoal(payload);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/goals", (req, res, next) => {
    try {
      const userId = String(req.query.user_id ?? "demo-user");
      const goals = goalService.listGoals(userId);
      res.status(200).json({ goals });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/v1/goals/:goalId/status", (req, res, next) => {
    try {
      const body = req.body ?? {};
      const goal = goalService.patchGoalStatus(req.params.goalId, body.status);
      res.status(200).json({ goal });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/goals/:goalId/activate", (req, res, next) => {
    try {
      const goal = goalService.activateGoal(req.params.goalId);
      res.status(200).json({ goal });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/goals/:goalId/clarifications", (req, res, next) => {
    try {
      const body = req.body ?? {};

      if (!Object.prototype.hasOwnProperty.call(body, "answers")) {
        throw badRequest("answers is required");
      }

      const result = goalService.submitClarifications(req.params.goalId, body.answers);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/goals/:goalId/assessment", (req, res, next) => {
    try {
      const body = req.body ?? {};
      const assessment = goalService.submitAssessment(req.params.goalId, body);
      res.status(200).json({ assessment });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/goals/:goalId/plans/generate", (req, res, next) => {
    try {
      const result = planService.triggerGeneration(req.params.goalId);
      res.status(202).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/goals/:goalId/plans/status", (req, res, next) => {
    try {
      const status = planService.getStatus(req.params.goalId);
      res.status(200).json(status);
    } catch (error) {
      next(error);
    }
  });

  app.use((req, _res, next) => {
    next(badRequest(`Route not found: ${req.method} ${req.path}`));
  });

  app.use((error, _req, res, _next) => {
    const status = error.status ?? 500;
    res.status(status).json({
      error: {
        message: error.message ?? "Internal server error"
      }
    });
  });

  return { app, services: { goalService, planService, specificityService }, store };
}
