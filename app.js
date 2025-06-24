/**
 * Module dependencies.
 */
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
const ScoreController = require("./controllers/ScoreController");
const SimulationStats = require("./models/SimulationStats");

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
  console.log("MongoDB is connected, setting up change stream…");

  const actionColl = mongoose.connection.db.collection("actions");
  const changeStream = actionColl.watch([], { fullDocument: "updateLookup" });

  changeStream.on("change", (change) => {
    io.emit("new action", change.fullDocument);
  });

  changeStream.on("error", (err) => {
    console.error("Change stream error:", err);
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
//every ten seconds calculate updated system score
schedule.scheduleJob("*/10 * * * * *", async () => {
  try {
    const allScores = await ScoreController.getAllScores();
    await SimulationStats.create(allScores);
    io.emit("scoreUpdate", allScores);
  } catch (err) {
    console.error("Score update error:", err);
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
app.get("/", passportConfig.isAuthenticated, scriptController.getScript);

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

app.get("/feed", passportConfig.isAuthenticated, scriptController.getScript);

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
