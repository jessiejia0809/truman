// export_user_data.js
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const outputDir = path.join(__dirname, "user_data");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

async function exportCollection(name, filter = {}) {
  const docs = await mongoose.connection.db
    .collection(name)
    .find(filter)
    .toArray();
  const filePath = path.join(outputDir, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(docs, null, 2));
  console.log(`exported ${docs.length} docs from ${name}`);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("connected to MongoDB");

  // export all chats
  await exportCollection("chats");

  // export only comments where commentType is "User"
  await exportCollection("comments", { commentType: "User" });

  await mongoose.disconnect();
  console.log("disconnected");
}

main().catch((err) => {
  console.error("error:", err);
  process.exit(1);
});
