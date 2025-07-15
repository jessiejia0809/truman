const http = require("http");
const express = require("express");
const app = require("./app");
const { Server } = require("socket.io");

const levelState = require("./controllers/levelState");
const ScoreController = require("./controllers/ScoreController");

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  socket.on("resetLevel", async ({ level }) => {
    try {
      // Clear all scores and state
      levelState.resetLevel(level);

      // Delete user-written comments for this level
      //await Comment.deleteMany({ level, postType: 'User' });

      console.log(`✅ Reset level ${level}`);
    } catch (err) {
      console.error("⚠️ Error resetting level:", err);
    }
  });
});

let broadcastInterval = null;

function startScoreBroadcastLoop() {
  if (broadcastInterval) clearInterval(broadcastInterval);

  broadcastInterval = setInterval(async () => {
    const timeLeft = levelState.getTimeLeft();
    const scores = await ScoreController.getAllScores();
    io.emit("scoreUpdate", scores);

    if (timeLeft <= 0) {
      clearInterval(broadcastInterval);
      broadcastInterval = null;
      console.log("[TIMER] Timer ended.");
    }
  }, 1000);
}

// Start when server boots
startScoreBroadcastLoop();

// Reset route to cleanly restart timer and score
app.get("/reset-level", async (req, res) => {
  console.log("[RESET] Resetting level...");

  // Reset timer
  levelState.resetLevelStartTime();

  // Reset score stored in memory/session
  // You could also clear Agent data if needed here
  // e.g., await Agent.updateMany({}, { $set: { score: 0 } });

  // Delay for sync
  setTimeout(() => {
    startScoreBroadcastLoop();
    res.redirect("/feed?level=1"); // or use currentLevel param
  }, 100); // delay to let timer sync
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
