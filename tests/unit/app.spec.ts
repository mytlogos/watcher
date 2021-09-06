import * as typeorm from "typeorm";
import { app } from "../../src/server/app";
import request from "supertest";
import { Project } from "../../src/server/entity/project";
import * as entities from "../../src/server/entity/project";

describe.skip("test express app", () => {
  beforeAll(() => {
    const original = typeorm.createConnection;
    jest.spyOn(typeorm, "createConnection").mockImplementation(() =>
      original({
        type: "sqlite",
        database: "watcher-test.db",
        synchronize: true,
        logging: false,
        entities: Object.values(entities),
        dropSchema: true,
        migrations: ["dist/server/migration/**/*.js"],
        subscribers: ["dist/server/subscriber/**/*.js"],
        cli: {
          migrationsDir: "src/server/migration",
        },
      })
    );
  });
  afterAll(async () => {
    return typeorm.getConnection().close();
  });
  it("responds", async () => {
    const response = await request(app).get("/");
    expect(response.status).toBe(200);
    expect(response.type).toMatch(/.*html.*/);
  });
  it("responds to projectApi", async () => {
    // it is empty at the beginning
    let response = await request(app).get("/api/project/");

    expect(response.status).toBe(200);
    expect(response.type).toMatch(/.*json.*/);
    expect(response.body as Project[]).toEqual([]);

    // should not yet exist
    response = await request(app).get("/api/project/1");

    expect(response.status).toBe(200);
    expect(response.type).toMatch(/.*json.*/);
    expect(response.body as Project | undefined).toEqual("");

    // create an item
    response = await request(app)
      .post("/api/project/")
      .send({
        isGlobal: false,
        name: "Name",
        path: "Path",
        type: "npm",
      } as Project);

    expect(response.status).toBe(200);
    expect(response.type).toMatch(/.*json.*/);
    let body = response.body as Project;

    expect(body).toBeDefined();
    expect(body.id).toBeGreaterThan(0);

    // not empty anymore
    response = await request(app).get("/api/project/");

    expect(response.status).toBe(200);
    expect(response.type).toMatch(/.*json.*/);
    expect(response.body as Project[]).toHaveLength(1);

    // should exist
    response = await request(app).get("/api/project/1");

    expect(response.status).toBe(200);
    expect(response.type).toMatch(/.*json.*/);
    body = response.body as Project;

    expect(body).toBeDefined();
    expect(body.id).toBeGreaterThan(0);

    // should be successfully deleted
    response = await request(app).delete("/api/project/1");

    expect(response.status).toBe(200);
    expect(response.type).toMatch(/.*json.*/);
    expect(response.body as boolean).toEqual(true);

    // should not exist anymore
    response = await request(app).get("/api/project/1");

    expect(response.status).toBe(200);
    expect(response.type).toMatch(/.*json.*/);
    expect(response.body).toEqual("");
  });
});
