import { Project } from "src/server/entity/project";
import { MutationTree } from "vuex";
import { State } from "./state";

function defineMutations<T extends MutationTree<State>>(params: T): T {
  return params;
}

type S = "s";
type R = `add${S}`;
type RestKeys<EntityName extends string> =
  | `create${EntityName}`
  | `update${EntityName}`
  | `delete${EntityName}`
  | `get${EntityName}`
  | `get${EntityName}All`;
// TODO: Research typescript string template
// interface RestMutationTree<E extends string> extends MutationTree<State> {
//   `add${E}`: () => void;
// }

// function createRestMutations<T extends Entity, R extends RestMutationTree>(
//   params: string
// ): R {
//   return {
//     add(state: State, thing: string) {
//       console.log("hi");
//     },
//   } as R;
// }

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
