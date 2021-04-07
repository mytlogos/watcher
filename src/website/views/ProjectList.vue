<template>
  <div class="container list">
    <div class="card my-5">
      <div class="card-body">
        <h5>Projects</h5>
        <ul class="list-group">
          <li
            class="list-group-item list-group-item-action"
            v-for="(item, index) in items"
            :key="item && item.id"
            role="button"
          >
            <project-list-item v-model:item="items[index]" />
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from "vue";
import { projectApi } from "../client";
import { mapState } from "vuex";
import ProjectListItem from "../components/ProjectListItem.vue";

export default defineComponent({
  components: { ProjectListItem },
  name: "ProjectList",
  computed: {
    ...mapState(["items"]),
  },
  created() {
    this.fetch().catch(console.error);
  },
  methods: {
    async fetch() {
      const items = await projectApi.getAll();
      this.$store.commit("setProjects", items);
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
