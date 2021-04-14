import { mount } from "@vue/test-utils";
import ProjectVue from "@/views/Project.vue";
import { Project } from "../../src/server/entity/project";
import { projectApi } from "@/client";
import flushPromises from "flush-promises";

describe("Project.vue", () => {
  it("renders unchecked non-global project correctly", async () => {
    const item = {
      id: 1,
      isGlobal: false,
      name: "Ich bin ein Projekt",
      path: "/path/to/project",
      type: "java",
    } as Project;

    const mockCheck = jest.spyOn(projectApi, "get");
    mockCheck.mockReturnValue(Promise.resolve(item));

    const wrapper = mount(ProjectVue, {
      props: {
        projectId: item.id,
      },
    });
    await flushPromises();

    expect(wrapper.find("[data-test=name]").text()).toEqual(
      "Project: " + item.name
    );
    expect(wrapper.find("[data-test=type]").text()).toEqual(item.type);
    expect(wrapper.find("[data-test=last_run]").text()).toEqual("Never");
    expect(wrapper.find("[data-test=path]").text()).toEqual(
      "Location: " + item.path
    );
    expect(wrapper.find("[data-test=load]").exists()).toEqual(false);
    expect(wrapper.find("[data-test=all_dependencies]").text()).toEqual(
      "Unknown Dependencies"
    );
    expect(wrapper.find("[data-test=outdated_dependencies]").text()).toEqual(
      "Unknown Outdated"
    );
  });
  it("renders unchecked global project correctly", async () => {
    const item = {
      id: 1,
      isGlobal: true,
      name: "Ich bin ein Projekt",
      path: "/path/to/project",
      type: "java",
    } as Project;

    const mockCheck = jest.spyOn(projectApi, "get");
    mockCheck.mockReturnValue(Promise.resolve(item));

    const wrapper = mount(ProjectVue, {
      props: {
        projectId: item.id,
      },
    });
    await flushPromises();

    expect(wrapper.find("[data-test=name]").text()).toEqual(
      "Project: " + item.name
    );
    expect(wrapper.find("[data-test=type]").text()).toEqual(item.type);
    expect(wrapper.find("[data-test=last_run]").text()).toEqual("Never");
    expect(wrapper.find("[data-test=path]").text()).toEqual("Location: Global");
    expect(wrapper.find("[data-test=load]").exists()).toEqual(false);
    expect(wrapper.find("[data-test=all_dependencies]").text()).toEqual(
      "Unknown Dependencies"
    );
    expect(wrapper.find("[data-test=outdated_dependencies]").text()).toEqual(
      "Unknown Outdated"
    );
  });
  it("renders checked project without dependencies correctly", async () => {
    const item = {
      id: 1,
      isGlobal: false,
      name: "Ich bin ein Projekt",
      path: "/path/to/project",
      type: "java",
      meta: {
        id: 1,
        dependencies: [],
        lastRun: new Date("2021-04-01T22:00:00Z"),
      },
    } as Project;

    const mockCheck = jest.spyOn(projectApi, "get");
    mockCheck.mockReturnValue(Promise.resolve(item));

    const wrapper = mount(ProjectVue, {
      props: {
        projectId: item.id,
      },
    });
    await flushPromises();

    expect(wrapper.find("[data-test=name]").text()).toEqual(
      "Project: " + item.name
    );
    expect(wrapper.find("[data-test=type]").text()).toEqual(item.type);
    expect(wrapper.find("[data-test=last_run]").text()).toEqual(
      item.meta?.lastRun?.toLocaleString()
    );
    expect(wrapper.find("[data-test=path]").text()).toEqual(
      "Location: " + item.path
    );
    expect(wrapper.find("[data-test=load]").exists()).toEqual(false);
    expect(wrapper.find("[data-test=all_dependencies]").text()).toEqual(
      "0 Dependencies"
    );
    expect(wrapper.find("[data-test=outdated_dependencies]").text()).toEqual(
      "0 Outdated"
    );
    expect(
      wrapper.find("[data-test=outdated_dependencies]").classes()
    ).toContain("bg-success");
  });
  it("renders checked project with dependencies correctly", async () => {
    const item = {
      id: 1,
      isGlobal: false,
      name: "Ich bin ein Projekt",
      path: "/path/to/project",
      type: "java",
      meta: {
        id: 1,
        dependencies: [
          {
            id: 1,
            availableVersions: "",
            currentVersion: "",
            data: "",
            name: "",
          },
          {
            id: 2,
            availableVersions: '["2.0"]',
            currentVersion: "",
            data: "",
            name: "",
          },
        ],
        lastRun: new Date("2021-04-01T22:00:00Z"),
      },
    } as Project;

    const mockCheck = jest.spyOn(projectApi, "get");
    mockCheck.mockReturnValue(Promise.resolve(item));

    const wrapper = mount(ProjectVue, {
      props: {
        projectId: item.id,
      },
    });
    await flushPromises();

    expect(wrapper.find("[data-test=name]").text()).toEqual(
      "Project: " + item.name
    );
    expect(wrapper.find("[data-test=type]").text()).toEqual(item.type);
    expect(wrapper.find("[data-test=last_run]").text()).toEqual(
      item.meta?.lastRun?.toLocaleString()
    );
    expect(wrapper.find("[data-test=path]").text()).toEqual(
      "Location: " + item.path
    );
    expect(wrapper.find("[data-test=load]").exists()).toEqual(false);
    expect(wrapper.find("[data-test=all_dependencies]").text()).toEqual(
      "2 Dependencies"
    );
    expect(wrapper.find("[data-test=outdated_dependencies]").text()).toEqual(
      "1 Outdated"
    );
    expect(
      wrapper.find("[data-test=outdated_dependencies]").classes()
    ).toContain("bg-warning");
  });
});
