export const WORKFLOW_STATE_TYPES = ["backlog", "unstarted", "started", "done"] as const;

export type WorkflowStateType = (typeof WORKFLOW_STATE_TYPES)[number];
