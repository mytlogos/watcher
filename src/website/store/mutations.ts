import { Project } from "src/server/entity/project";
import { MutationTree } from "vuex";
import { State } from "./state";

function defineMutations<T extends MutationTree<State>>(params: T): T {
  return params;
}

export type Mutations = typeof mutations;

export const mutations = defineMutations({
  addProject(state, project: Project) {
    state.items.push(project);
  },
  setProjects(state, projects: Project[]) {
    state.items.length = 0;
    state.items.push(...projects);
  },
});
