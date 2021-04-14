<template>
  <div class="container list">
    <div class="card my-5">
      <div class="card-body">
        <h5 data-test="name">Project: {{ item?.name }}</h5>
        <div class="d-flex w-100 justify-content-between">
          <span data-test="type">{{ item?.type }}</span>
          <span title="Last run" data-test="last_run">{{
            item?.meta?.lastRun?.toLocaleString() || "Never"
          }}</span>
        </div>
        <div class="d-flex w-100 justify-content-between">
          <span class="my-auto" data-test="path"
            >Location: {{ pathDisplay }}</span
          >
          <span class="my-auto" v-if="loading" data-test="load"
            >Checking...</span
          >
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
            {{ outdatedDependencies }} Outdated
          </span>
          <div class="d-inline-block">
            <button
              class="btn btn-info m-1"
              type="button"
              role="button"
              @click="check"
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
        <ul class="list-group">
          <li class="list-group-item d-flex row m-0 bg-secondary text-light">
            <span class="col-4">Name</span>
            <span class="col-4">Current Version</span>
            <span class="col-4">New Versions</span>
          </li>
          <li
            class="list-group-item d-flex row m-0"
            v-for="item in dependencies"
            :key="item.id"
            data-test="dependency"
          >
            <span class="col-4" data-test="dep_name">{{ item.name }}</span>
            <span class="col-4" data-test="dep_current">{{
              item.currentVersion
            }}</span>
            <span class="col-4" v-show="item.availableVersions.length">
              <span
                v-for="version in item.availableVersions"
                :key="version"
                class="badge bg-warning"
                data-test="dep_available"
                >{{ version }}</span
              >
            </span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import { Dependency, Project } from "src/server/entity/project";
import { defineComponent } from "vue";
import { projectApi } from "@/client";

// @ts-expect-error overwrite string to parsed value
interface ParsedDependency extends Dependency {
  availableVersions: string[];
}

export default defineComponent({
  name: "Project",
  props: {
    projectId: { type: Number, required: true },
  },
  data() {
    return {
      loading: false,
      item: null as null | Project,
    };
  },
  computed: {
    pathDisplay(): string {
      if (this.item?.isGlobal) {
        return "Global";
      }
      return this.item?.path || "";
    },
    dependencies(): ParsedDependency[] {
      return (this.item?.meta?.dependencies || []).map((dep) => {
        if (
          typeof dep.availableVersions === "string" &&
          dep.availableVersions
        ) {
          dep.availableVersions = JSON.parse(dep.availableVersions) || [];
        } else if (!dep.availableVersions) {
          // @ts-expect-error set default value
          dep.availableVersions = [] as string[];
        }
        return (dep as unknown) as ParsedDependency;
      });
    },
    dependencyCount(): string {
      if (!this.item?.meta) {
        return "Unknown";
      }
      return this.item.meta.dependencies?.length + "";
    },
    outdatedDependencyCount(): number {
      if (!this.item?.meta || !this.item.meta.dependencies) {
        return -1;
      }
      return this.item.meta.dependencies.filter(
        (dep) => dep.availableVersions && dep.availableVersions.length > 0
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
  async created() {
    this.item = await projectApi.get(this.projectId);
  },
  methods: {
    async check() {
      if (!this.item) {
        return;
      }
      this.loading = true;
      try {
        const result = await projectApi.check(this.item);
        this.item = result;
      } finally {
        this.loading = false;
      }
    },
  },
});
</script>
