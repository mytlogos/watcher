import { expect } from "chai";
import { shallowMount } from "@vue/test-utils";
import ProjectListItem from "../../src/website/components/ProjectListItem.vue";

describe("ProjectListItem.vue", () => {
  it("renders props.msg when passed", () => {
    const msg = "new message";
    const wrapper = shallowMount(ProjectListItem, {
      props: {
        item: {
          path: "",
          type: "",
          name: msg,
          isGlobal: false,
          meta: undefined,
        },
      },
    });
    expect(wrapper.text()).to.include(msg);
  });
});
