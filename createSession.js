/**
 * Node script to create or update a single session containing all scenarios ordered by level and CSV order.
 * Usage: node createSession.js <sessionName>
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config();
const mongoose = require("mongoose");
const CSVToJSON = require("csvtojson");
const Scenario = require("./models/Scenario");
const Session = require("./models/Session");

// Ensure MongoDB URI and session name are provided
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI not set in .env");
  process.exit(1);
}

const sessionName = process.argv[2];
if (!sessionName) {
  console.error("Usage: node createSession.js <sessionName>");
  process.exit(1);
}

(async () => {
  // Connect to database
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Load level→folder mappings
  const orderPath = path.join(__dirname, "scenarios", "level_order.json");
  const levelOrder = JSON.parse(fs.readFileSync(orderPath, "utf8"));

  // Collect all scenario IDs in order
  const allScenarioIds = [];
  for (const { folder } of levelOrder) {
    const csvPath = path.join(__dirname, folder, "scenarios.csv");
    const records = await CSVToJSON().fromFile(csvPath);
    for (const { name } of records) {
      const scen = await Scenario.findOne({ name }).exec();
      allScenarioIds.push(scen._id);
    }
  }

  // Upsert session with ordered scenario list
  await Session.findOneAndUpdate(
    { name: sessionName },
    { name: sessionName, scenarios: allScenarioIds },
    { upsert: true },
  );
  const envPath = path.join(__dirname, ".env");
  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  }
  const line = `SESSION_NAME=${sessionName}`;
  if (envContent.match(/^SESSION_NAME=/m)) {
    envContent = envContent.replace(/^SESSION_NAME=.*$/m, line);
  } else {
    if (envContent && !envContent.endsWith("\n")) envContent += "\n";
    envContent += line + "\n";
  }
  fs.writeFileSync(envPath, envContent, "utf8");
  console.log(`Wrote to .env → ${line}`);

  console.log(
    `Session '${sessionName}' synced with ${allScenarioIds.length} scenarios.`,
  );
  await mongoose.disconnect();
})();
