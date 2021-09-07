<template>
  <div class="container list">
    <div class="card my-5">
      <div class="card-body">
        <h5 data-test="name">Global Settings</h5>
        <form>
          <h6>Add Remote Setting</h6>
          <div class="mb-3">
            <label for="new-remote-name" class="form-label">Name</label>
            <input
              type="text"
              class="form-control"
              v-model="newRemote.name"
              id="new-remote-name"
              aria-describedby="emailHelp"
            />
            <div id="new-remote-name-help" class="form-text">For Display</div>
          </div>
          <div class="mb-3">
            <label for="new-remote-host" class="form-label">Remote Host</label>
            <input
              type="text"
              class="form-control"
              id="new-remote-host"
              v-model="newRemote.host"
              aria-describedby="new-remote-host-help"
            />
            <div id="new-remote-host-help" class="form-text">
              Like "github.com"
            </div>
          </div>
          <div class="mb-3">
            <label for="new-remote-priority" class="form-label">Priority</label>
            <input
              type="number"
              min="0"
              class="form-control"
              id="new-remote-priority"
              v-model="newRemote.priority"
              aria-describedby="new-remote-priority-help"
            />
            <div id="new-remote-priority-help" class="form-text">
              The higher the value the smaller the priority
            </div>
          </div>
          <div class="mb-3">
            <label for="new-remote-username" class="form-label">Username</label>
            <input
              type="text"
              class="form-control"
              id="new-remote-username"
              v-model="newRemote.username"
              aria-describedby="new-remote-username-help"
            />
            <div id="new-remote-username-help" class="form-text">
              Authentication Username of Remote
            </div>
          </div>
          <div class="mb-3">
            <label for="new-remote-token" class="form-label">Token</label>
            <input
              type="password"
              class="form-control"
              id="new-remote-token"
              v-model="newRemote.token"
            />
            <div id="new-remote-username-help" class="form-text">
              Authentication Token of Remote
            </div>
          </div>
          <button
            type="button"
            @click.left="addRemoteSettings"
            class="btn btn-primary"
          >
            Add Remote
          </button>
        </form>
        <ul class="list-group">
          <li class="list-group-item d-flex row m-0 bg-secondary text-light">
            <span class="col-4">Name</span>
            <span class="col-4">Host</span>
            <span class="col-4">User</span>
          </li>
          <li
            class="list-group-item d-flex row m-0"
            v-for="item of settings.remotes"
            :key="item.id"
            data-test="remotesetting"
          >
            <span class="col-4" data-test="remote_name"
              >{{ item.name }}
              <span
                class="badge rounded-pill bg-light text-dark"
                title="Priority"
                >{{ item.priority }}</span
              >
            </span>
            <span class="col-4" data-test="remote_host">{{ item.host }}</span>
            <span class="col-4" data-test="remote_user">{{
              item.username
            }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import { RemoteSetting } from "src/server/entity/settings";
import { defineComponent } from "vue";
import { settingsApi } from "@/client";

export default defineComponent({
  name: "Settings",
  data() {
    return {
      loading: false,
      settings: {
        remotes: [] as RemoteSetting[],
      },
      newRemote: {
        name: "",
        host: "",
        username: "",
        token: "",
        priority: 0,
      } as RemoteSetting,
    };
  },
  async created() {
    this.settings = await settingsApi.get();
  },
  methods: {
    async addRemoteSettings() {
      const result = await settingsApi.createRemoteSetting({
        name: this.newRemote.name,
        host: this.newRemote.host,
        username: this.newRemote.username,
        token: this.newRemote.token,
        priority: this.newRemote.priority,
      });
      this.settings.remotes.push(result);
    },
  },
});
</script>
