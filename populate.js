const { Actor } = require("./models/Actor.js");
const Script = require("./models/Script.js");
const Comment = require("./models/Comment.js");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const CSVToJSON = require("csvtojson");
const _ = require("lodash");

const color_start = "\x1b[33m%s\x1b[0m"; // yellow
const color_success = "\x1b[32m%s\x1b[0m"; // green
const color_error = "\x1b[31m%s\x1b[0m"; // red

console.log(color_start, "Started populate.js script...");

//Input Files
const actor_inputFile = "./input/actors.csv";
const posts_inputFile = "./input/posts.csv";
const replies_inputFile = "./input/replies.csv";

dotenv.config({ path: ".env" });

mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI, {
  useNewUrlParser: true,
});
const db = mongoose.connection;
mongoose.connection.on("error", (err) => {
  console.error(err);
  console.error(
    color_error,
    "MongoDB connection error. Please make sure MongoDB is running.",
  );
  process.exit(1);
});

const currDateAtPopulate = Date.now();

async function doPopulate() {
  console.log(color_start, "Dropping actors...");
  await db.collections["actors"].drop();
  console.log(color_success, "Actors collection dropped");

  console.log(color_start, "Dropping scripts...");
  await db.collections["scripts"].drop();
  console.log(color_success, "Scripts collection dropped");

  console.log(color_start, "Dropping comments...");
  await db.collections["comments"].drop();
  console.log(color_success, "Comments collection dropped");

  console.log(color_start, "Reading actors list...");
  const actors_list = await CSVToJSON().fromFile(actor_inputFile);
  console.log(color_success, "Finished getting the actors_list");

  console.log(color_start, "Reading posts list...");
  const posts_list = await CSVToJSON().fromFile(posts_inputFile);
  console.log(color_success, "Finished getting the posts list");

  console.log(color_start, "Reading comment list...");
  const comments_list = await CSVToJSON().fromFile(replies_inputFile);
  console.log(color_success, "Finished getting the comment list");

  /*
   * Create all the Actors in the simulation
   * Must be done before creating any other instances
   */
  const actors = Object.fromEntries(
    actors_list.map(function (actor_raw) {
      const actor = new Actor({
        username: actor_raw.username,
        profile: {
          name: actor_raw.name,
          gender: actor_raw.gender,
          age: actor_raw.age,
          location: actor_raw.location,
          bio: actor_raw.bio,
          picture: actor_raw.picture,
        },
        class: actor_raw.class,
      });

      return [actor.username, actor];
    }),
  );

  /*
   * Create each post and upload it to the DB
   * Actors must be in DB first to add them correctly to the post
   */
  const posts = Object.fromEntries(
    posts_list.map(function (post) {
      const actor = actors[post.actor];
      if (actor) {
        const script = new Script({
          body: post.body,
          picture: post.picture,
          actorLikes: post.likes || getLikes(),
          postType: "Actor",
          poster: actor,
          time: timeStringToNum(post.time) || null,
          absTime: new Date(currDateAtPopulate + timeStringToNum(post.time)),
          class: post.class,
        });
        actor.posts.push(script._id);

        return [post.id, script];
      } else {
        //Else no actor found
        throw new ReferenceError(`ERROR: Unknown Actor "${post.actor}"`);
      }
    }),
  );

  /*
   * Creates inline comments for each post
   * Looks up actors and posts to insert the correct comment
   */
  const comments = comments_list.map(function (reply) {
    const actor = actors[reply.actor];
    if (!actor) {
      //No actor found
      throw new ReferenceError(`ERROR: Unknown Actor "${reply.actor}"`);
    }
    const post = posts[reply.postID];
    if (!post) {
      //No post found
      throw new ReferenceError(`ERROR: Unknown Post #${reply.postID}`);
    }

    if (post.time > timeStringToNum(reply.time)) {
      throw new RangeError(
        `ERROR: The simulated time for comment #${reply.id} is before the simulated post time.`,
      );
    }

    const comment = new Comment({
      commentType: "Actor",
      commentor: actor,
      post: post._id,
      body: reply.body,
      actorLikes: reply.likes || getLikesComment(),
      time: timeStringToNum(reply.time),
      absTime: new Date(currDateAtPopulate + timeStringToNum(reply.time)),
      class: reply.class,
    });

    const index = _.sortedIndexBy(posts.comments, comment, ({ time }) => time);
    post.comments.splice(index, 0, comment._id);

    actor.comments.push(comment._id);

    return comment;
  });

  try {
    console.log(color_success, "All actors added to database!");
    console.log(color_start, "Starting to populate actors collection...");
    await Actor.bulkSave(Object.values(actors));

    console.log(color_start, "Starting to populate posts collection...");
    await Script.bulkSave(Object.values(posts));
    console.log(color_success, "All posts added to database!");

    console.log(color_start, "Starting to populate post replies...");
    await Comment.bulkSave(comments);
    console.log(color_success, "All replies added to database!");
  } catch (err) {
    console.error(
      color_error,
      "ERROR: Something went wrong saving objects in the database",
    );
    console.error(err);
  }

  mongoose.connection.close();
}

//Transforms a time like -12:32 (minus 12 hours and 32 minutes) into a time in milliseconds
//Positive numbers indicate future posts (after they joined), Negative numbers indicate past posts (before they joined)
//Format: (+/-)HH:MM
function timeStringToNum(v) {
  var timeParts = v.split(":");
  if (timeParts[0] == "-0")
    // -0:XX
    return (
      -1 * parseInt(timeParts[0] * (60000 * 60) + timeParts[1] * 60000, 10)
    );
  else if (timeParts[0].startsWith("-"))
    //-X:XX
    return parseInt(
      timeParts[0] * (60000 * 60) + -1 * (timeParts[1] * 60000),
      10,
    );
  else return parseInt(timeParts[0] * (60000 * 60) + timeParts[1] * 60000, 10);
}

//Create a random number (for the number of likes) with a weighted distrubution
//This is for posts
function getLikes() {
  var notRandomNumbers = [1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 6];
  var idx = Math.floor(Math.random() * notRandomNumbers.length);
  return notRandomNumbers[idx];
}

//Create a random number (for likes) with a weighted distrubution
//This is for comments
function getLikesComment() {
  var notRandomNumbers = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 3, 4,
  ];
  var idx = Math.floor(Math.random() * notRandomNumbers.length);
  return notRandomNumbers[idx];
}

// Call the populate function
doPopulate();
