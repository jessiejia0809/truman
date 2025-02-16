const { Actor } = require("../models/Actor.js");
const User = require("../models/User");
const Agent = require("../models/Agent");
const helpers = require("./helpers");
const dotenv = require("dotenv");
const _ = require("lodash");
dotenv.config({ path: ".env" }); // See the file .env.example for the structure of .env

/**
 * GET /actors
 * If the current user is an admin, retrieve all the actors from the database and render them to the page '../views/actors'.
 * If the current user is not an admin, redirect the user to the home page.
 */
exports.getActors = async (req, res, next) => {
  if (!req.user.isAdmin) {
    res.redirect("/");
  } else {
    try {
      const actors = await Actor.find().exec();
      const agents = await Agent.find().exec();
      res.render("actors", { actors, agents });
    } catch (err) {
      console.error(err);
      next(err);
    }
  }
};

/**
 * GET /user/:username
 * Retrieve the profile and relevant experimental posts of the actor whose username field value matches the query parameter value 'username'.
 * Process the posts with the helper function .getFeed() in ./helpers.js.
 * Check if the current user has blocked or reported the actor.
 * Render the actor's profile page along with the relevant data.
 */
exports.getActor = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).exec();
    const { actor, actorType } = await helpers.lookupActorByName(
      req.params.username,
    );

    const isBlocked =
      user.blocked.findIndex(({ actorId }) => actor._id.equals(actorId)) !== -1;
    const isReported =
      user.reported.findIndex(({ actorId }) => actor._id.equals(actorId)) !==
      -1;

    const finalFeed = await helpers.getFeed(
      user,
      "CHRONOLOGICAL",
      process.env.REMOVE_FLAGGED_CONTENT === "TRUE",
      false,
      process.env.SHOW_FUTURE_CONTENT === "TRUE",
      actor,
    );

    res.render("actor", {
      script: finalFeed,
      actor,
      isBlocked,
      isReported,
      title: actor.profile.name,
      actorType,
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
};

/**
 * POST /user
 * Handle post requests to block, unblock, report, follow, and unfollow an actor.
 */
exports.postBlockReportOrFollow = async (req, res, next) => {
  const currDate = Date.now();
  try {
    const user = await User.findById(req.user.id).exec();
    // Block an actor
    if (req.body.blocked) {
      const { actor, actorType } = await helpers.lookupActorByName(
        req.body.blocked,
      );
      const index = user.blocked.findIndex(({ actorId }) =>
        actor._id.equals(actorId),
      );
      if (index === -1) {
        user.blocked.push({ actorId: actor._id, actorType });
      }
      const log = {
        time: currDate,
        action: "block",
        actorName: req.body.blocked,
      };
      user.blockReportAndFollowLog.push(log);
    }
    // Unblock a user
    else if (req.body.unblocked) {
      const { actor } = await helpers.lookupActorByName(req.body.unblocked);
      const index = user.blocked.findIndex(({ actorId }) =>
        actor._id.equals(actorId),
      );
      if (index > -1) {
        user.blocked.splice(index, 1);
      }
      const log = {
        time: currDate,
        action: "unblock",
        actorName: req.body.unblocked,
      };
      user.blockReportAndFollowLog.push(log);
    }
    // Report an actor
    else if (req.body.reported) {
      const { actor, actorType } = await helpers.lookupActorByName(
        req.body.reported,
      );
      const index = user.reported.findIndex(({ actorId }) =>
        actor._id.equals(actorId),
      );
      if (index === -1) {
        user.reported.push({ actorId: actor._id, actorType });
      }
      const log = {
        time: currDate,
        action: "report",
        actorName: req.body.reported,
        report_issue: req.body.report_issue,
      };
      user.blockReportAndFollowLog.push(log);
    }
    // Follow an actor
    else if (req.body.followed) {
      const { actor, actorType } = await helpers.lookupActorByName(
        req.body.followed,
      );
      const index = user.followed.findIndex(({ actorId }) =>
        actor._id.equals(actorId),
      );
      if (index === -1) {
        user.followed.push({ actorId: actor._id, actorType });
      }
      const log = {
        time: currDate,
        action: "follow",
        actorName: req.body.followed,
      };
      user.blockReportAndFollowLog.push(log);
    } // Unfollow an actor
    else if (req.body.unfollowed) {
      const { actor } = await helpers.lookupActorByName(req.body.unfollowed);
      const index = user.followed.findIndex(({ actorId }) =>
        actor._id.equals(actorId),
      );
      if (index > -1) {
        user.followed.splice(index, 1);
      }
      const log = {
        time: currDate,
        action: "unfollow",
        actorName: req.body.unfollowed,
      };
      user.blockReportAndFollowLog.push(log);
    }
    await user.save();
    res.send({ result: "success" });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /actors/new
 * Render the new actor form.
 */
exports.getNewActor = async (req, res, next) => {
  if (!req.user.isAdmin) {
    res.redirect("/");
  } else {
    try {
      res.render("actors/new", { user: req.user });
    } catch (err) {
      console.error(err);
      next(err);
    }
  }
};

/**
 * POST /actors/new
 * Create new user with name, gender, age, location, bio, picture, class.
 */
exports.postNewActor = async (req, res, next) => {
  const { name, gender, age, location, bio, username, actorType } = req.body;
  const picture = req.file ? req.file.filename : null; // Handle file upload (if using multer)

  // Create a new actor based on form data
  const actorDetail = {
    username: username,
    profile: {
      name: name,
      gender: gender,
      age: age,
      location: location,
      bio: bio,
      picture: picture,
    },
    class: "user_created_actor", // You can set a default or dynamic class here
  };

  const actor =
    actorType === "Agent" ? new Agent(actorDetail) : new Actor(actorDetail);
  try {
    await actor.save();
  } catch (err) {
    console.error("Something went wrong with saving actor in database");
    next(err);
  }

  res.redirect("/actors"); // Redirect to actors page after saving
};
