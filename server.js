const http = require("http");
const app = require("./app");
const { Server } = require("socket.io");
const levelState = require("./controllers/levelState");
const ScoreController = require("./controllers/ScoreController");

const server = http.createServer(app);
const io = new Server(server);

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Reset level when client requests
  socket.on("resetLevel", async () => {
    console.log(`[SOCKET] Resetting level for ${socket.id}`);
    levelState.resetLevelStartTime(); // reset timer

    const userId = socket.user?.id || socket.id; // use session ID or real user
    await Comment.deleteMany({ level: currentLevel, user: userId });

    const scores = await ScoreController.getAllScores(); // get fresh score
    io.emit("scoreUpdate", scores); // update all clients
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
