import * as typeorm from "typeorm";
import { app } from "../../src/server/app";
import request from "supertest";

describe("test express app", () => {
  beforeAll(() => {
    const original = typeorm.createConnection;
    jest.spyOn(typeorm, "createConnection").mockImplementation(() =>
      original({
        type: "sqlite",
        database: "watcher-test.db",
        synchronize: true,
        logging: false,
        entities: ["dist/server/entity/**/*.js"],
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
  });
});
