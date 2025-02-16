const Script = require("../models/Script.js");
const Comment = require("../models/Comment.js");
const Agent = require("../models/Agent");
const Session = require("../models/Session");
const User = require("../models/User");
const helpers = require("./helpers");
const _ = require("lodash");
const dotenv = require("dotenv");
dotenv.config({ path: ".env" });

/**
 * GET /
 * Fetch and render newsfeed.
 */
exports.getScript = async (req, res, next) => {
  try {
    const one_day = 86400000; // Number of milliseconds in a day.
    const time_now = Date.now(); // Current date.
    const time_diff = time_now - req.user.createdAt; // Time difference between now and user account creation, in milliseconds.

    const user = await User.findById(req.user.id).exec();

    // If the user is no longer active, sign the user out.
    if (!user.active) {
      req.logout((err) => {
        if (err) console.log("Error : Failed to logout.", err);
        req.session.destroy((err) => {
          if (err)
            console.log(
              "Error : Failed to destroy the session during logout.",
              err,
            );
          req.user = null;
          req.flash("errors", {
            msg: "Account is no longer active. Study is over.",
          });
          res.redirect(
            "/login" + (req.query.r_id ? `?r_id=${req.query.r_id}` : ""),
          );
        });
      });
    }

    // What day in the study is the user in?
    // Update study_days, which tracks the number of time user views feed.
    const current_day = Math.floor(time_diff / one_day);
    if (current_day < process.env.NUM_DAYS) {
      helpers.ensureDays(user.study_days, current_day);
      user.study_days[current_day] += 1;
      user.save();
    }

    // Get the newsfeed and render it.
    const finalfeed = await helpers.getFeed(
      user,
      process.env.FEED_ORDER,
      process.env.REMOVE_FLAGGED_CONTENT === "TRUE",
      true,
      process.env.SHOW_FUTURE_CONTENT === "TRUE",
    );
    res.render("script", { script: finalfeed, showNewPostIcon: true });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

/**
 * Helper for making Agent/User posts
 */
const makePost = async (user, body, session, file) => {
  const currDate = Date.now();
  const isAgent = user.isAdmin === undefined;

  let post = {
    postType: isAgent ? "Agent" : "User",
    poster: user.id,
    session: session._id,
    body: body,
    picture: file ? file.filename : "",
    actorLikes: 0, // This value will never change.
    absTime: currDate,
    time: currDate - user.createdAt,
    likes: 0,
  };

  //Add new post to Script
  const new_post = new Script(post);
  await new_post.save();
};

const performFeedAction = async (userId, isAgent, body, session) => {
  const user = await (
    isAgent ? Agent.findById(userId) : User.findById(userId).populate("session")
  )
    .populate("postAction")
    .populate("commentAction")
    .exec();

  // Retrieve post from database
  const post = await Script.findById(body.postID)
    .populate("poster")
    .populate({
      path: "comments",
      populate: {
        path: "commentor",
      },
    })
    .exec();

  // Check if user has interacted with the post before.
  let postIndex = _.findIndex(user.postAction, function (o) {
    return o.post.equals(body.postID);
  });

  // If the user has not interacted with the post before, add the post to user.feedAction.
  if (postIndex == -1) {
    postIndex = user.postAction.push({ post: post._id }) - 1;
  }

  // User created a new comment on the post.
  if (body.new_comment) {
    // Add new comment to comment database
    const comment = new Comment({
      commentType: isAgent ? "Agent" : "User",
      commentor: userId,
      session: isAgent ? session.id : user.session.id,
      post: body.postID,
      body: body.comment_text,
      time: body.new_comment - user.createdAt,
      absTime: body.new_comment,
      comments: [],
    });
    await comment.save();

    // Add reference to comment to post it was made on
    post.comments.push(comment._id);
    await post.save();

    return { post, comment };
  }

  // User interacted with a comment on the post.
  if (body.commentID) {
    // Find comment
    const comment = await Comment.findById(body.commentID)
      .populate("commentor")
      .exec();

    // Check if user has interacted with the comment before.
    let commentIndex = _.findIndex(user.commentAction, function (o) {
      return o.comment.equals(body.commentID);
    });

    // If the user has not interacted with the comment before, add the comment to user.commentActions
    if (commentIndex == -1) {
      user.commentAction.push({ comment: body.commentID });
      commentIndex = user.commentAction.length - 1;
    }

    const commentAction = user.commentAction[commentIndex];

    // User liked the comment.
    if (body.like) {
      const like = body.like;
      commentAction.likeTime.push(like);
      commentAction.liked = true;
      comment.likes++;
    }
    // User unliked the comment.
    else if (body.unlike) {
      const unlike = body.unlike;
      commentAction.unlikeTime.push(unlike);
      commentAction.liked = false;
      comment.likes--;
    }

    // User flagged the comment.
    if (body.flag) {
      const flag = body.flag;
      commentAction.flagTime.push(flag);
      commentAction.flagged = true;
    }
    // User unflagged the comment.
    else if (body.unflag) {
      const unflag = body.unflag;
      commentAction.unflagTime.push(unflag);
      commentAction.flagged = false;
    }

    // User shared the comment.
    if (body.share) {
      const share = body.share;
      commentAction.shareTime.push(share);
      commentAction.shared = true;
    }
    await comment.save();
    await user.save();

    return { post, comment };
  }
  // User interacted with the post.
  const postAction = user.postAction[postIndex];

  // User flagged the post.
  if (body.flag) {
    const flag = body.flag;
    postAction.flagTime.push(flag);
    postAction.flagged = true;
  }
  // User unflagged the post.
  else if (body.unflag) {
    const unflag = body.unflag;
    postAction.unflagTime.push(unflag);
    postAction.flagged = false;
  }

  // User liked the post.
  if (body.like) {
    const like = body.like;
    postAction.likeTime.push(like);
    postAction.liked = true;
    post.likes++;
  }
  // User unliked the post.
  else if (body.unlike) {
    const unlike = body.unlike;
    postAction.unlikeTime.push(unlike);
    postAction.liked = false;
    post.likes--;
  }

  // User shared the post.
  if (body.share) {
    const share = body.share;
    postAction.shareTime.push(share);
    postAction.shared = true;
  }

  // User read the post.
  if (body.viewed) {
    const view = body.viewed;
    postAction.readTime.push(view);
    postAction.rereadTimes++;
    postAction.mostRecentTime = Date.now();
  }
  await post.save();
  await user.save();

  return { post };
};

/**
 * POST /action
 * Processes model output and adds it to the feed.
 */
exports.postAction = async (req, res, next) => {
  try {
    const { action, author, actionObject, actionBody, timestamp, sessionName } =
      req.body;

    // Find the user corresponding to the author
    const user = await Agent.findOne({ username: author }).exec();
    const session = await Session.findOne({ name: sessionName }).exec();
    // Map the action to the appropriate field
    if (action === "post") {
      await makePost(user, actionBody, session);
    } else {
      const body = {};
      const post = await Script.findById(actionObject).exec();
      if (!post) {
        // if post not found, then create a comment request
        const comment = await Comment.findById(actionObject).exec();
        body.postID = comment.post;
        body.commentID = actionObject;
      } else {
        body.postID = actionObject;
      }

      // Timestamp is sent in ISO 8601 format, so parse to get milliseconds
      const time = Date.parse(timestamp);
      if (action === "comment") {
        body.new_comment = time;
        body.comment_text = actionBody;
      } else if (action === "like") {
        body.like = time;
      } else if (action === "flag") {
        body.flag = time;
      } else if (action === "share") {
        body.share = time;
      }
      await performFeedAction(user._id, true, body, session);
    }
    req.io.to(session._id.toString()).emit("timeline activity");
    res.send({ result: "success" });
  } catch (err) {
    next(err);
  }
};

/*
 * Post /post/new
 * Record a new user-made post. Include any actor replies (comments) that go along with it.
 */
exports.newPost = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).exec();
    await makePost(user, req.body.body, user.session, req.file);
    req.io
      .to(user.session._id.toString())
      .except(req.session.id)
      .emit("timeline activity");
    res.redirect("/");
  } catch (err) {
    console.log(err);
    next(err);
  }
};

/**
 * POST /feed/
 * Record user's actions on ACTOR/other USER's posts.
 */
exports.postUpdateFeedAction = async (req, res, next) => {
  try {
    const { post, comment } = await performFeedAction(
      req.user.id,
      false,
      req.body,
    );

    const user = await User.findById(req.user.id).exec();
    req.io
      .to(user.session._id.toString())
      .except(req.session.id)
      .emit("timeline activity");
    res.send({ result: "success", postID: post._id, commentID: comment?._id });
  } catch (err) {
    next(err);
  }
};
