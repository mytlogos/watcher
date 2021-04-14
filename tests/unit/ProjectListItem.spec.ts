import { mount } from "@vue/test-utils";
import ProjectListItem from "@/components/ProjectListItem.vue";
import { Project } from "../../src/server/entity/project";

describe("ProjectListItem.vue", () => {
  it("renders props.msg when passed", () => {
    const msg = "new message";
    const wrapper = mount(ProjectListItem, {
      props: {
        item: {
          path: "",
          type: "",
          name: msg,
          isGlobal: false,
          meta: undefined,
        } as Project,
      },
    });
    expect(wrapper.text()).toEqual(expect.stringContaining(msg));
  });
});
