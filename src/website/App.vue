<template>
  <div class="d-flex flex-column vh-100">
    <nav
      class="navbar navbar-expand-lg navbar-dark"
      style="background-color: #588a00 !important"
    >
      <div class="container">
        <a class="navbar-brand" href="#">Watcher</a>
        <button
          class="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarSupportedContent"
          aria-controls="navbarSupportedContent"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarSupportedContent">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0">
            <li class="nav-item">
              <router-link class="nav-link" to="/">Home</router-link>
            </li>
            <li class="nav-item">
              <button class="btn" type="button" @click="createProject">
                Add Project
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
    <router-view />
    <create-project ref="createProjectModal" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import CreateProject from "./components/CreateProject.vue";

export default defineComponent({
  name: "App",
  components: { CreateProject },
  methods: {
    createProject() {
      (this.$refs.createProjectModal as typeof CreateProject).show();
    },
  },
});
</script>
<style>
@media (min-width: 700px) {
  .container.list {
    max-width: 700px;
  }
}
</style>
