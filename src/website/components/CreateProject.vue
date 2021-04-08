<template>
  <modal ref="modal">
    <template #body>
      <div class="row">
        <div class="col">
          <select
            class="form-select"
            v-model="type"
            aria-label="Select a Manager"
          >
            <option selected>Select a Manager</option>
            <option v-for="option in typeOptions" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
        </div>
        <div class="form-check col my-auto">
          <input
            v-model="isGlobal"
            class="form-check-input"
            type="checkbox"
            value=""
            id="globalCheck"
          />
          <label class="form-check-label" for="globalCheck"> Is Global </label>
        </div>
      </div>
      <div class="mb-3">
        <label for="path-input" class="form-label">Project Path</label>
        <input
          v-model="path"
          type="text"
          class="form-control"
          id="path-input"
          placeholder="Write a Path"
          :disabled="isGlobal"
        />
      </div>
      <div class="mb-3">
        <label for="name-input" class="form-label">Project Name</label>
        <input
          v-model="name"
          type="text"
          class="form-control"
          id="name-input"
          placeholder="Name of the Project"
          @input="nameTyped = true"
        />
      </div>
    </template>
  </modal>
</template>
<script lang="ts">
import { defineComponent } from "vue";
import { projectApi } from "../client";
import modal from "./modal.vue";

export default defineComponent({
  name: "CreateProject",
  components: { modal },
  data() {
    return {
      typeOptions: ["pip", "npm", "maven"],
      type: "pip",
      name: "",
      path: "",
      nameTyped: false,
      isGlobal: false,
    };
  },
  watch: {
    path() {
      if ((!this.name || !this.nameTyped) && !this.isGlobal) {
        const filename = this.path.split(/[\\/]/).pop();
        this.name = filename || "";
      }
    },
    isGlobal() {
      if ((!this.name || !this.nameTyped) && this.isGlobal) {
        this.name = "Global - " + this.type;
      }
    },
    type() {
      if ((!this.name || !this.nameTyped) && this.isGlobal) {
        this.name = "Global - " + this.type;
      }
    },
  },
  methods: {
    reset() {
      this.isGlobal = false;
      this.type = "pip";
      this.name = "";
      this.path = "";
      this.nameTyped = false;
    },
    getModal(): typeof modal {
      return (this.$refs.modal as unknown) as typeof modal;
    },
    async submit() {
      try {
        const result = await projectApi.check(
          {
            path: this.isGlobal ? "" : this.path,
            type: this.type,
            name: this.name,
            isGlobal: this.isGlobal,
            meta: undefined,
          },
          true
        );
        const project = await projectApi.create(result);
        this.$store.commit("addProject", project);
      } catch (error) {
        console.error(error);
        this.getModal().showError(error.message);
        return false;
      }
      return true;
    },
    show() {
      this.getModal().show({
        onSubmit: () => this.submit(),
        onClose: () => this.reset(),
      });
    },
  },
});
</script>
