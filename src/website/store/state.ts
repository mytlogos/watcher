import { Project } from "src/server/entity/project";

export const state = {
  items: [] as Project[],
};

export type State = typeof state;
