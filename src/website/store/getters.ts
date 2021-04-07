import { GetterTree } from "vuex";
import { State } from "./state";

export type Getters = typeof getters;
export const getters: GetterTree<State, State> = {};
