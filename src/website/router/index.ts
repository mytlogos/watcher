import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import ProjectList from "../views/ProjectList.vue";
import Project from "../views/Project.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "Home",
    component: ProjectList,
  },
  {
    path: "/project/:id",
    name: "Project",
    props: (route) => ({ projectId: Number(route.params.id) }),
    component: Project,
  },
  {
    path: "/about",
    name: "About",
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () =>
      import(/* webpackChunkName: "about" */ "../views/About.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

export default router;
