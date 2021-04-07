<template>
  <div ref="modal" class="modal fade" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <slot name="title" />
          </h5>
          <button
            type="button"
            class="btn-close"
            aria-label="Close"
            @click="close"
          ></button>
        </div>
        <div class="modal-body">
          <slot name="body" />
        </div>
        <div class="modal-footer">
          <slot name="footer" :close="() => close" :submit="() => submit">
            <button
              type="button"
              class="btn btn-secondary"
              data-dismiss="modal"
              @click.left="close"
            >
              <slot name="close">Close</slot>
            </button>
            <button type="button" class="btn btn-primary" @click.left="submit">
              <slot name="submit">Save</slot>
            </button>
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent, markRaw } from "vue";
import { Modal } from "bootstrap";

type Callback<R = void> = () => R;
type SubmitCallback = Callback<boolean | Promise<boolean>>;

export interface Show {
  /**
   * Callback returns true if it should close
   */
  onSubmit: SubmitCallback;
  onClose: Callback;
}

export default defineComponent({
  name: "Modal",
  emits: ["submit", "close"],
  data() {
    return {
      onSubmit: undefined as undefined | SubmitCallback,
      onClose: undefined as undefined | Callback,
      showing: false,
      errorMessage: "",
      modal: null as null | Modal,
    };
  },
  mounted(): void {
    console.log(this.$refs.modal);
    // dont observe bootstrap things, it's not a data model
    this.modal = markRaw(new Modal(this.$refs.modal as HTMLElement));
    document.addEventListener(
      "click",
      (evt) => {
        if (
          !(this.$refs.modal as HTMLElement).contains(
            evt.target as Node | null
          ) &&
          this.showing
        ) {
          evt.stopImmediatePropagation();
          evt.preventDefault();
          this.close();
        }
      },
      { capture: true }
    );
  },
  methods: {
    close(): void {
      this.$emit("close");

      if (this.onClose) {
        this.onClose();
      }
      this.modal?.hide();
    },
    submit() {
      this.$emit("submit");

      if (this.onSubmit) {
        const shouldClose = this.onSubmit();

        if (typeof shouldClose === "object" && shouldClose instanceof Promise) {
          shouldClose.then((close: boolean) => close && this.close());
        } else if (shouldClose) {
          this.close();
        }
      } else {
        this.close();
      }
    },
    show({ onClose, onSubmit }: Show): void {
      this.onSubmit = onSubmit;
      this.onClose = onClose;
      this.modal?.show();
    },
    showError(message: string): void {
      this.errorMessage = message;
    },
  },
});
</script>
