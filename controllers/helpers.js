const { Actor } = require("../models/Actor.js");
const Agent = require("../models/Agent.js");
const User = require("../models/User.js");
const Script = require("../models/Script.js");
const _ = require("lodash");

// From https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
// Function shuffles the content of an array and returns the shuffled array.
function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;
  // While there remain elements to shuffle.
  while (currentIndex != 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }
  return array;
}

/**
 * This is a helper function, called in .getScript() (./script.js controller file), .getActor() (./actors.js controller file).
 * It takes in a User document, and other parameters, and it processes and generates a final feed of posts for the user based on these parameters.
 * Parameters:
 *  - user: a User document
 *  - order: 'SHUFFLE', 'CHRONOLOGICAL'; indicates the order the posts in the final feed should be displayed in.
 *  - removedFlaggedContent (boolean): T/F; indicates if a flagged post should be removed from the final feed.
 *  - removeBlockedUserContent (boolean): T/F; indicates if posts from a blocked user should be removed from the final feed.
 *  - actor (Actor/Agent/User): if provided restrict the posts to those from the passed in actor.
 * Returns:
 *  - the processed final feed of posts for the user
 */
exports.getFeed = async function (
  user,
  order,
  removeFlaggedContent,
  removeBlockedUserContent,
  showFutureContent,
  actor,
) {
  const commonQuery = {
    $or: [{ session: null }, { session: user.session }],
    class: { $in: ["", user.experimentalCondition] },
    ...(showFutureContent ? {} : { absTime: { $lte: Date.now() } }),
  };
  const makeBlockedQuery = (field) => {
    return removeBlockedUserContent
      ? { [field]: { $nin: user.blocked.map(({ actorId }) => actorId) } }
      : {};
  };
  const flaggedPosts = removeFlaggedContent
    ? user.postAction
        .filter((action) => action.flagged)
        .map((action) => action.post)
    : [];
  const flaggedComments = removeFlaggedContent
    ? user.commentAction
        .filter((action) => action.flagged)
        .map((action) => action.comment)
    : [];

  // Array of actor and other user's posts that match the user's experimental condition, within the past 24 hours, sorted by time.
  const posts = await Script.find({
    _id: { $nin: flaggedPosts },
    ...(actor ? { poster: actor.id } : {}),
    ...makeBlockedQuery("poster"),
    ...commonQuery,
  })
    .populate("poster")
    .populate({
      path: "comments",
      populate: { path: "commentor" },
      match: {
        _id: { $nin: flaggedComments },
        ...makeBlockedQuery("commentor"),
        ...commonQuery,
      },
    })
    .sort("absTime")
    .exec();

  // Array of posts for the final feed
  const feed = [];
  // Array of seen and unseen posts, used when order=='shuffle' so that unseen posts appear before seen posts on the final feed.
  const feed_seen = [];
  const feed_unseen = [];

  // While there are posts to add to the feed
  while (posts.length) {
    const post = posts.pop();
    // Check if user has any interactions with comments
    for (const comment of post.comments) {
      // update comment likes with likes from actors
      comment.likes += comment.actorLikes;
      // check if user has interacted with this comment
      const commentIndex = _.findIndex(user.commentAction, function (o) {
        return o.comment.equals(comment._id);
      });
      if (commentIndex != -1) {
        const action = user.commentAction[commentIndex];
        // Check if this comment has been liked by the user. If true, update the comment in the post.
        if (action.liked) {
          comment.liked = true;
        }
        // Check if this comment has been flagged by the user. If true, remove the comment from the post.
        if (action.flagged) {
          comment.flagged = true;
        }
      }
    }

    // Sort the comments in the post from least to most recent.
    post.comments.sort(function (a, b) {
      return a.absTime - b.absTime;
    });

    // update post likes with likes from actors
    post.likes += post.actorLikes;

    // Check if the user has interacted with this post by checking if a user.postAction.post value matches this post's _id.
    // If the user has interacted with this post, add the user's interactions to the post.
    const postIndex = _.findIndex(user.postAction, function (o) {
      return o.post.equals(post._id);
    });
    if (postIndex != -1) {
      const action = user.postAction[postIndex];
      // Check if this post has been liked by the user. If true, update the post.
      if (action.liked) {
        post.liked = true;
      }
      // Check if this post has been flagged by the user. If true, update the post.
      if (action.flagged) {
        post.flagged = true;
      }
      if (order == "SHUFFLE") {
        if (!action.readTime[0]) {
          feed_unseen.push(post);
        } else {
          feed_seen.push(post);
        }
      } else {
        feed.push(post);
      }
    } // If the user has not interacted with this post:
    else {
      if (order == "SHUFFLE") {
        feed_unseen.push(post);
      } else {
        feed.push(post);
      }
    }
  }

  return order == "SHUFFLE"
    ? // Shuffle the feed
      shuffle(feed_unseen).concat(shuffle(feed_seen))
    : feed;
};

exports.ensureDays = function (day_array, current_day) {
  if (day_array.length <= current_day) {
    day_array.push(...Array(current_day - day_array.length + 1).fill(0));
  }
};

exports.lookupActorByName = async function (username) {
  // Sequentially find the actor as an Actor, Agent, or User, setting type accordingly
  const actor = await Actor.findOne({ username: username }).exec();
  if (actor) {
    return { actor, actorType: "Actor" };
  }

  const agent = await Agent.findOne({ username: username }).exec();
  if (agent) {
    return { actor: agent, actorType: "Agent" };
  }

  const user = await User.findOne({ username: username }).exec();
  if (user) {
    return { actor: user, actorType: "User" };
  }

  throw new Error("Actor not found");
};
