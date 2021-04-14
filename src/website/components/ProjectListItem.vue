<template>
  <div class="d-flex w-100 justify-content-between">
    <h5>{{ item.name }}</h5>
    <span>{{ item.type }}</span>
    <span title="Last run">{{
      (item.meta && item.meta.lastRun.toLocaleString()) || "Never"
    }}</span>
  </div>
  <div class="d-flex w-100 justify-content-between">
    <span class="my-auto">Location: {{ pathDisplay }}</span>
    <span class="my-auto" v-if="loading">Checking...</span>
  </div>
  <div class="d-flex w-100 justify-content-between">
    <span class="my-auto">{{ dependencyCount }} Dependencies</span>
    <span
      class="badge my-auto"
      :class="{
        'bg-success': outdatedDependencyCount === 0,
        'bg-warning':
          outdatedDependencyCount > 0 && outdatedDependencyCount < 10,
        'bg-danger': outdatedDependencyCount > 0,
      }"
      style="max-height: 2em"
    >
      {{ outdatedDependencies }}
      Outdated
    </span>
    <div class="d-inline-block">
      <button class="btn btn-info m-1" type="button" @click.stop="check">
        Recheck
      </button>
      <button class="btn btn-danger m-1 disabled" type="button">Delete</button>
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
