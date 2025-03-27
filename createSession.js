/*
This script is run from the command line.
<node createSession.js sessionName scenarioName>

Create a new session tied to the specified scenario.

This script uses the connection information from your local .env file (in line 22 or server)
so set your local .env variables to match the database you want to connect to.
*/

const crypto = require("crypto");
const Scenario = require("./models/Scenario.js");
const Session = require("./models/Session.js");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

/**
 * Load environment variables from .env file.
 */
dotenv.config({ path: ".env" });

/**
 * Connect to MongoDB.
 */
// establish initial Mongoose connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true });
// listen for errors after establishing initial connection
mongoose.connection.on("error", (err) => {
  console.error(err);
  console.error("MongoDB connection error.");
  process.exit(1);
});

const color_start = "\x1b[33m%s\x1b[0m"; // yellow
const color_success = "\x1b[32m%s\x1b[0m"; // green
const color_error = "\x1b[31m%s\x1b[0m"; // red

async function createSession() {
  // command inputs
  const myArgs = process.argv.slice(2);
  const sessionName = myArgs[0];
  const scenarioName = myArgs[1];

  const existingSession = await Session.findOne({ name: sessionName }).exec();
  if (existingSession) {
    console.error(color_error, "ERROR: Session with that name already exists!");
    mongoose.connection.close();
    return;
  }

  const scenario = await Scenario.findOne({ name: scenarioName }).exec();
  if (!scenario) {
    console.error(
      color_error,
      "ERROR: Cannot find scenario with the name",
      scenarioName,
    );
    mongoose.connection.close();
    return;
  }

  const session = new Session({
    name: sessionName,
    scenario: scenario._id,
  });
  await session.save();

  console.log(
    color_success,
    "Session successfully created. Closing db connection.",
  );
  mongoose.connection.close();
}

createSession();
