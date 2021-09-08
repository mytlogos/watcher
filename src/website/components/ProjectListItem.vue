<template>
  <div class="d-flex w-100 justify-content-between">
    <h5 data-test="name">{{ item.name }}</h5>
    <span data-test="type">{{ item.type }}</span>
    <span title="Last run" data-test="last_run">{{
      (item.meta && item.meta.lastRun && item.meta.lastRun.toLocaleString()) ||
      "Never"
    }}</span>
  </div>
  <div class="d-flex w-100 justify-content-between">
    <span class="my-auto" data-test="path">Location: {{ pathDisplay }}</span>
    <span v-if="remoteDisplay" class="my-auto" data-test="path">
      Remote: <a :href="remoteLink">{{ remoteDisplay }}</a>
    </span>
    <span class="my-auto" v-if="loading" data-test="load">Checking...</span>
  </div>
  <div class="d-flex w-100 justify-content-between">
    <span class="my-auto" data-test="all_dependencies"
      >{{ dependencyCount }} Dependencies</span
    >
    <span
      class="badge my-auto"
      :class="{
        'bg-success': outdatedDependencyCount === 0,
        'bg-warning':
          outdatedDependencyCount > 0 && outdatedDependencyCount < 10,
        'bg-danger': outdatedDependencyCount > 0,
      }"
      style="max-height: 2em"
      data-test="outdated_dependencies"
    >
      {{ outdatedDependencies }}
      Outdated
    </span>
    <div class="d-inline-block">
      <button
        class="btn btn-info m-1"
        type="button"
        role="button"
        @click.stop="check"
        data-test="check"
      >
        Recheck
      </button>
      <button
        class="btn btn-danger m-1 disabled"
        type="button"
        role="button"
        data-test="delete"
      >
        Delete
      </button>
    </div>
  </div>
</template>
<script lang="ts">
import { Project } from "src/server/entity/project";
import { defineComponent, PropType } from "vue";
import { projectApi } from "@/client";

export default defineComponent({
  name: "ProjectListItem",
  props: {
    item: { type: Object as PropType<Project>, required: true },
  },
  emits: ["update:item"],
  data() {
    return {
      loading: false,
    };
  },
  computed: {
    pathDisplay(): string {
      if (this.item.isGlobal) {
        return "Global";
      }
      return this.item?.path || "";
    },
    remoteDisplay(): string {
      if (this.item.isGlobal) {
        return "";
      }
      return this.item?.remotes?.length ? this.item.remotes[0].name : "";
    },
    remoteLink(): string {
      if (this.item.isGlobal) {
        return "#";
      }
      return this.item?.remotes?.length ? this.item.remotes[0].path : "#";
    },
    dependencyCount(): string {
      if (!this.item.meta) {
        return "Unknown";
      }
      return this.item.meta.dependencies?.length + "";
    },
    outdatedDependencyCount(): number {
      if (!this.item.meta || !this.item.meta.dependencies) {
        return -1;
      }
      return this.item.meta.dependencies?.filter(
        (dep) => dep.availableVersions && dep.availableVersions.length > 3
      ).length;
    },
    outdatedDependencies(): string | number {
      if (this.outdatedDependencyCount < 0) {
        return "Unknown";
      } else {
        return this.outdatedDependencyCount;
      }
    },
  },
  methods: {
    async check() {
      this.loading = true;
      try {
        const result = await projectApi.check(this.item);
        this.$emit("update:item", result);
      } finally {
        this.loading = false;
      }
    },
  },
});
</script>
