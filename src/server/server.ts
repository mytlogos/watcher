#!/usr/bin/env node
import debug from "debug";
import { createServer, Server } from "http";
import os from "os";
import { app } from "./app";

const port = process.env.port || "5335";
const debugMessenger = debug("enterprise-lister:server");

/**
 * Get port from environment and store in Express.
 */
app.set("port", port);

/**
 * Create HTTP server.
 */
const server: Server = createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on("error", onError);
server.on("listening", onListening);

/**
 * Event listener for HTTP server "error" event.
 */
function onError(error: Error | any) {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = "Port " + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */
function onListening() {
  console.log("I am listening");
  const address = server.address();

  if (address != null) {
    const bind =
      typeof address === "string" ? "pipe " + address : "port " + address.port;

    const networkInterfaces = os.networkInterfaces();

    for (const arrays of Object.values(networkInterfaces)) {
      if (!Array.isArray(arrays)) {
        continue;
      }
      const foundIpInterface = arrays.find((value) => value.family === "IPv4");

      if (
        !foundIpInterface ||
        !foundIpInterface.address ||
        !foundIpInterface.address.startsWith("192.168.")
      ) {
        continue;
      }
      debugMessenger(
        `Listening on ${bind} with Ip: '${
          foundIpInterface && foundIpInterface.address
        }'`
      );
      console.info(
        `Process PID: ${process.pid} in environment '${process.env.NODE_ENV}'`
      );
      break;
    }
  } else {
    debugMessenger("No Address");
  }
}
