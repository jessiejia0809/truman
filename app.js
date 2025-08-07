/**
 * Module dependencies.
 */

require("dotenv").config();

const express = require("express");
const compression = require("compression");
const session = require("express-session");
const bodyParser = require("body-parser");
const logger = require("morgan");
const errorHandler = require("errorhandler");
const lusca = require("lusca");
const dotenv = require("dotenv");
const MongoStore = require("connect-mongo");
const flash = require("express-flash");
const path = require("path");
const mongoose = require("mongoose");
const passport = require("passport");
const schedule = require("node-schedule");
const multer = require("multer");
const fs = require("fs");
const util = require("util");
fs.readFileAsync = util.promisify(fs.readFile);
const http = require("http");
const { Server } = require("socket.io");
const SimulationStats = require("./models/SimulationStats");
const Grader = require("./controllers/Grader");
const Session = require("./models/Session");
const sessionName = process.env.SESSION_NAME;
const pendingActions = [];
let currentLevel = 1;
/**
 * Middleware for handling multipart/form-data, which is primarily used for uploading files.
 * Files are uploaded when user's upload their profile photos and post photos.
 */
var userpost_options = multer.diskStorage({
  destination: path.join(__dirname, "uploads/user_post"),
  filename: function (req, file, cb) {
    var lastsix = req.user.id.substr(req.user.id.length - 6);
    var prefix = lastsix + Math.random().toString(36).slice(2, 10);
    cb(null, prefix + file.originalname.replace(/[^A-Z0-9]+/gi, "_"));
  },
});
var useravatar_options = multer.diskStorage({
  destination: path.join(__dirname, "uploads/user_avatar"),
  filename: function (req, file, cb) {
    var prefix = req.user.id + Math.random().toString(36).slice(2, 10);
    cb(null, prefix + file.originalname.replace(/[^A-Z0-9]+/gi, "_"));
  },
});

const userpostupload = multer({ storage: userpost_options });
const useravatarupload = multer({ storage: useravatar_options });
const csrf = lusca.csrf();

/**
 * Load environment variables from .env file.
 */
dotenv.config({ path: ".env" });

/**
 * Controllers (route handlers).
 */
const actorsController = require("./controllers/actors");
const scriptController = require("./controllers/script");
const userController = require("./controllers/user");
const chatController = require("./controllers/chat");
const ScoreController = require("./controllers/ScoreController");
const scoreController = new ScoreController(); // ✅ create an instance
const feedbackService = require("./controllers/feedbackService");
const levelState = require("./controllers/levelState");

/**
 * Models.
 */
const Comment = require("./models/Comment");
const Objective = require("./models/Objective");

/**
 * API keys and Passport configuration.
 */
const passportConfig = require("./config/passport");

/**
 * Create Express server.
 */
const app = express();

/**
 * Create Socket.io server.
 */
const server = http.createServer(app);
const io = new Server(server);

/**
 * Connect to MongoDB.
 */
mongoose.connect(process.env.MONGODB_URI, {
  /* your options */
});

mongoose.connection.once("open", () => {
  console.log("MongoDB connected, watching agents, chats, and comments…");
  const changeStream = mongoose.connection.db.watch(
    [
      {
        $match: {
          "ns.coll": { $in: ["agents", "chats", "comments"] },
        },
      },
    ],
    { fullDocument: "updateLookup" },
  );

  changeStream.on("change", (change) => {
    const entry = {
      op: change.operationType,
      coll: change.ns.coll,
      doc: change.fullDocument || change.documentKey,
    };

    pendingActions.push(entry);
    io.emit("db-change", entry);
  });

  changeStream.on("error", (err) => {
    console.error("Database change stream error:", err);
  });
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
  process.exit(1);
});

/**
 * Cron Jobs:
 * Check if users are still active every 8 hours (at 4:30am, 12:30pm, and 20:30pm).
 */
const rule1 = new schedule.RecurrenceRule();
rule1.hour = 4;
rule1.minute = 30;
schedule.scheduleJob(rule1, function () {
  userController.stillActive();
});

const rule2 = new schedule.RecurrenceRule();
rule2.hour = 12;
rule2.minute = 30;
schedule.scheduleJob(rule2, function () {
  userController.stillActive();
});

const rule3 = new schedule.RecurrenceRule();
rule3.hour = 20;
rule3.minute = 30;
schedule.scheduleJob(rule3, function () {
  userController.stillActive();
});

schedule.scheduleJob("*/1 * * * * *", async () => {
  try {
    const healthScore = await scoreController.getHealthScore(currentLevel);
    const timeLeft = levelState.getTimeLeft(currentLevel);
    const totalTime = levelState.getTotalDuration(currentLevel);

    const isNumber = (n) => typeof n === "number" && !isNaN(n);
    if (!isNumber(healthScore)) {
      console.warn("🚨 Invalid healthScore from controller:", healthScore);
      return;
    }

    const payload = { healthScore, level: currentLevel, timeLeft, totalTime };
    io.emit("scoreUpdate", payload);
    console.log("[Score Update Emitted]", payload);
  } catch (err) {
    console.error("Score update error:", err);
  }
});

/**
 * Every 10 seconds, pop pendingActions and run the grader
 */
schedule.scheduleJob("*/10 * * * * *", async () => {
  // grab & clear the queue
  const toGrade = pendingActions.splice(0, pendingActions.length);
  if (toGrade.length === 0) return;

  try {
    const grader = new Grader({
      level: currentLevel,
      scoreController,
    });
    await grader.init();

    const categories = await grader.classifyActionsWithLLM(toGrade);
    console.log("Classified categories:", categories);

    const newHealth = await grader.applyDeltas(categories);
    console.log(`Level ${currentLevel} health updated to ${newHealth}`);
    await grader.processNextSteps(categories);
  } catch (err) {
    console.error("Grader job error:", err);
  }
});

/**
 * Express configuration.
 */
app.set("port", process.env.PORT || 3000);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");
//app.use(expressStatusMonitor());
app.use(compression());
app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Create a session middleware that can be shared between
// Express and socket.io
const sessionMiddleware = session({
  resave: true,
  saveUninitialized: true,
  secret: process.env.SESSION_SECRET,
  cookie: {
    path: "/",
    httpOnly: true,
    secure: false,
    maxAge: 86400000, //24 hours
  },
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: "express-sessions",
  }),
});
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);
app.use((req, res, next) => {
  req.io = io;
  next();
});
app.use(passport.initialize());
app.use(passportConfig.authenticate);
app.use(flash());
app.use(
  lusca.csrf({
    blocklist: [
      // REST API endpoints don't need CSRF, see:
      // https://security.stackexchange.com/a/166798
      "/action",
      // Multer multipart/form-data handling needs to occur before the Lusca
      // CSRF check.  It's a weird issue that multer and lusca do not play well
      // together. So add all multipart/form-data routes to the general
      // blocklist, then define Lusca CSRF in the definition of the routes to
      // ensure the proper ordering.  See this github comment for more details:
      // https://github.com/expressjs/multer/issues/195#issuecomment-129568691
      "/post/new",
      "/actors/new",
      "/account/profile",
      "/account/signup_info_post",
      "/api/feedback",
      "/score/reset",
    ],
  }),
);

app.use(lusca.xframe("SAMEORIGIN"));
app.use(lusca.xssProtection(true));
app.disable("x-powered-by");
// allow-from https://example.com/
// add_header X-Frame-Options "allow-from https://cornell.qualtrics.com/";
// app.use(lusca.xframe('allow-from https://cornell.qualtrics.com/'));
app.use((req, res, next) => {
  res.locals.user = req.user;
  res.locals.cdn = process.env.CDN;
  next();
});

app.use((req, res, next) => {
  // If a user attempts to access a site page that requires logging in, but
  // they are not logged in, then record the page they desired to visit. After
  // successfully logging in, redirect the user back to their desired page.
  if (
    !req.user &&
    req.path !== "/login" &&
    req.path !== "/signup" &&
    req.path !== "/pageLog" &&
    req.path !== "/pageTimes" &&
    !req.path.match(/\./)
  ) {
    req.session.returnTo = req.originalUrl;
  }
  next();
});

app.use(
  "/public",
  express.static(path.join(__dirname, "public"), { maxAge: 31557600000 }),
);
app.use(
  "/semantic",
  express.static(path.join(__dirname, "semantic"), { maxAge: 31557600000 }),
);
app.use(
  express.static(path.join(__dirname, "uploads"), { maxAge: 31557600000 }),
);
app.use(
  "/post_pictures",
  express.static(path.join(__dirname, "post_pictures"), {
    maxAge: 31557600000,
  }),
);
app.use(
  "/profile_pictures",
  express.static(path.join(__dirname, "profile_pictures"), {
    maxAge: 31557600000,
  }),
);

/**
 * Primary app routes.
 */
app.get(
  "/",
  passportConfig.isAuthenticated,
  async (req, res, next) => {
    const level = parseInt(req.query.level, 10) || 1;
    req.query.level = level;
    currentLevel = level;
    await Session.findOneAndUpdate({ name: sessionName }, { level });
    next();
  },
  scriptController.getScript,
);

app.get("/chat", chatController.getChat);
app.post("/chat", chatController.postChatAction);

app.post(
  "/post/new",
  userpostupload.single("picinput"),
  csrf,
  scriptController.newPost,
);
app.post(
  "/pageLog",
  passportConfig.isAuthenticated,
  userController.postPageLog,
);
app.post(
  "/pageTimes",
  passportConfig.isAuthenticated,
  userController.postPageTime,
);

app.get("/com", function (req, res) {
  // Are we accessing the community rules from the feed?
  const feed = req.query.feed == "true" ? true : false;
  res.render("com", {
    title: "Community Rules",
    feed,
  });
});

app.get("/info", passportConfig.isAuthenticated, function (req, res) {
  res.render("info", {
    title: "User Docs",
  });
});

app.get("/tos", function (req, res) {
  res.render("tos", { title: "Terms of Service" });
});

app.get(
  "/completed",
  passportConfig.isAuthenticated,
  userController.userTestResults,
);

app.get("/login", userController.getLogin);
app.post("/login", userController.postLogin);
app.get("/logout", userController.logout);
app.get("/forgot", userController.getForgot);
app.get("/signup", userController.getSignup);
app.post("/signup", userController.postSignup);

app.get("/account", passportConfig.isAuthenticated, userController.getAccount);
app.post(
  "/account/password",
  passportConfig.isAuthenticated,
  userController.postUpdatePassword,
);
app.post(
  "/account/profile",
  passportConfig.isAuthenticated,
  useravatarupload.single("picinput"),
  csrf,
  userController.postUpdateProfile,
);
app.get(
  "/account/signup_info",
  passportConfig.isAuthenticated,
  csrf,
  function (req, res) {
    res.render("account/signup_info", {
      title: "Add Information",
    });
  },
);
app.post(
  "/account/signup_info_post",
  passportConfig.isAuthenticated,
  useravatarupload.single("picinput"),
  csrf,
  userController.postSignupInfo,
);
app.post(
  "/account/consent",
  passportConfig.isAuthenticated,
  userController.postConsent,
);

app.get(
  "/user/:username",
  passportConfig.isAuthenticated,
  actorsController.getActor,
);
app.post(
  "/user",
  passportConfig.isAuthenticated,
  actorsController.postBlockReportOrFollow,
);
app.get("/actors", passportConfig.isAuthenticated, actorsController.getActors);
app.get(
  "/actors/new",
  passportConfig.isAuthenticated,
  csrf,
  actorsController.getNewActor,
);
app.post(
  "/actors/new",
  useravatarupload.single("picinput"),
  csrf,
  actorsController.postNewActor,
);

app.get(
  "/feed",
  passportConfig.isAuthenticated,
  async (req, res, next) => {
    const level = parseInt(req.query.level, 10) || 1;
    currentLevel = level;
    console.log(`[LEVEL] currentLevel set to ${currentLevel}`);

    // persist level into the single session document
    try {
      await Session.findOneAndUpdate(
        { name: sessionName },
        { level: currentLevel },
      );
    } catch (err) {
      console.error("Failed to update session level:", err);
    }

    next();
  },
  scriptController.getScript,
);

app.post(
  "/action",
  passportConfig.isAuthenticated,
  scriptController.postAction,
);

app.post(
  "/feed",
  passportConfig.isAuthenticated,
  scriptController.postUpdateFeedAction,
);

app.get("/test", passportConfig.isAuthenticated, function (req, res) {
  res.render("test", {
    title: "Test",
  });
});

app.post("/api/feedback", async (req, res) => {
  //app.post("/api/feedback", passportConfig.isAuthenticated, async (req, res) => {
  try {
    const user = req.user;
    const actions = req.body.actions;

    if (!Array.isArray(actions)) {
      return res
        .status(400)
        .json({ error: "Missing or invalid actions array" });
    }

    const feedback = await feedbackService.analyzeFailedLevelActions(
      actions,
      user,
    );
    res.json({ feedback });
  } catch (err) {
    console.error("Feedback analysis error:", err);
    res.status(500).json({ error: "Failed to analyze actions" });
  }
});

app.get("/reset-level", async (req, res) => {
  currentLevel = parseInt(req.query.level, 10) || 1;
  console.log(`[RESET] Resetting level ${currentLevel}`);
  await Session.findOneAndUpdate(
    { name: sessionName },
    { level: currentLevel },
  );

  const allComments = await Comment.find();
  console.log("📋 All comments:", allComments);

  const userComments = await Comment.find({ commentType: "User" });
  console.log("👤 User comments before deletion:", userComments);

  await Comment.deleteMany({
    commentType: "User",
  });
  objectives = await Objective.find({ level: currentLevel });
  for (const obj of objectives) {
    obj.completed = false;
    await obj.save();
  }
  levelState.resetLevelStartTime();

  scoreController.resetScores(currentLevel);

  setTimeout(() => {
    res.redirect(`/feed?level=${currentLevel}`);
  }, 100);
});

app.get("/api/objectives", passportConfig.isAuthenticated, async (req, res) => {
  try {
    const level = parseInt(req.query.level, 10);

    if (!level) {
      return res.status(400).json({ error: "Missing level query param" });
    }

    // Step 1: Fetch all objectives for the level (you could also limit by user if needed)
    const objectives = await Objective.find({ level }).lean();

    // Step 2: Ensure completed is explicitly included
    const response = objectives.map((obj) => ({
      _id: obj._id,
      label: obj.label,
      description: obj.description,
      completed: !!obj.completed,
      hint: obj.hint || "",
    }));

    res.json(response);
  } catch (err) {
    console.error("❌ Error fetching objectives:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get(
  "/api/bullying-post",
  passportConfig.isAuthenticated,
  async (req, res) => {
    try {
      const level = parseInt(req.query.level, 10) || currentLevel;

      // Use Script model since bullying posts are saved there
      const Script = require("./models/Script.js");

      const post = await Script.findOne({
        level: level,
        isRelevant: true,
      }).lean();

      if (!post) {
        return res.status(204).send(); // No content
      }

      return res.json({ bullyingPostId: post._id.toString() });
    } catch (err) {
      console.error("❌ Error in /api/bullying-post:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

/**
 * Error Handler.
 */
app.use(errorHandler());

// Catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error("Not Found");
  err.status = 404;
  next(err);
});

// Error handler
app.use(function (err, req, res) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // Render the error page
  res.status(err.status || 500);
  res.render("error");
});

/**
 * Socket connection.
 */
io.on("connection", (socket) => {
  const req = socket.request;
  userController.joinRooms(socket);

  // Automatically reload the Express session on each new packet over the socket
  // as the socket is not tied to a single http request
  socket.use((__ /*[event, ...args]*/, next) => {
    req.session.reload((err) => {
      if (err) {
        socket.disconnect();
      } else {
        next();
      }
    });
  });

  // TODO: Revisit to fixup timeline and chat indicators
  socket.on("chat message", (msg) => {
    // emit to all listening sockets but the one sending
    socket.broadcast.emit("chat message", msg);
  });

  socket.on("chat typing", (msg) => {
    // emit to all listening sockets but the one sending
    socket.broadcast.emit("chat typing", msg);
  });

  socket.on("levelChanged", async (data) => {
    const { level } = data;
    console.log(`📣 Level changed to ${level}`);

    await Session.findOneAndUpdate(
      { name: sessionName },
      { level: currentLevel },
    );
    await scoreController.resetScores(currentLevel);
    levelState.setLevel(level);
    levelState.resetLevelStartTime();
    scoreController.resetScores(currentLevel);

    // // Reset score immediately
    // await ScoreController.resetScores();

    // // Emit updated score immediately
    // const newScore = await ScoreController.getAllScores();
    // io.emit("scoreUpdate", newScore);
  });

  socket.on("resetLevel", async ({ level }) => {
    try {
      const currentLevel = parseInt(level, 10) || 1;
      console.log(`[RESET] (socket) Resetting level ${currentLevel}`);

      await Session.findOneAndUpdate(
        { name: sessionName },
        { level: currentLevel },
      );

      const allComments = await Comment.find();
      console.log("📋 All comments:", allComments);

      const userComments = await Comment.find({ commentType: "User" });
      console.log("👤 User comments before deletion:", userComments);

      await Comment.deleteMany({ commentType: "User" });

      const objectives = await Objective.find({ level: currentLevel });
      for (const obj of objectives) {
        obj.completed = false;
        await obj.save();
      }

      levelState.resetLevelStartTime();

      await scoreController.resetScores(currentLevel);

      console.log(`✅ Socket: Level ${currentLevel} reset complete`);
      socket.emit("levelResetConfirmed", { level: currentLevel });
    } catch (err) {
      console.error("❌ Socket: Failed to reset level:", err);
      socket.emit("levelResetFailed", { error: err.message });
    }
  });

  socket.on("error", function (err) {
    console.log(err);
  });
});

/**
 * Start Express server.
 */
server.listen(app.get("port"), () => {
  console.log(
    `App is running on http://localhost:${app.get("port")} in ${app.get("env")} mode.`,
  );
  console.log("  Press CTRL-C to stop\n");
});
module.exports = app;
