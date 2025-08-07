const { Actor, validateUsername } = require("./models/Actor.js");
const Agent = require("./models/Agent.js");
const Script = require("./models/Script.js");
const Comment = require("./models/Comment.js");
const Scenario = require("./models/Scenario.js");
const Objective = require("./models/Objective.js");
const fs = require("fs/promises");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const CSVToJSON = require("csvtojson");
const _ = require("lodash");

const color_start = "\x1b[33m%s\x1b[0m"; // yellow
const color_success = "\x1b[32m%s\x1b[0m"; // green
const color_error = "\x1b[31m%s\x1b[0m"; // red

console.log(color_start, "Started populate.js script...");

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
const postImageDir = "uploads/user_post/";
const profileImageDir = "uploads/user_avatar/";

async function doPopulate(path, level) {
  const actor_inputFile = `${path}/actors.csv`;
  const agent_inputFile = `${path}/agents.csv`;
  const posts_inputFile = `${path}/posts.csv`;
  const replies_inputFile = `${path}/replies.csv`;
  const scenarios_inputFile = `${path}/scenarios.csv`;
  const objectives_inputFile = `${path}/objectives.csv`;

  console.log(color_start, "Reading actors list...");
  const actors_list = await CSVToJSON().fromFile(actor_inputFile);
  console.log(color_success, "Finished getting the actors_list");

  console.log(color_start, "Reading agents list...");
  const agents_list = await CSVToJSON().fromFile(agent_inputFile);
  console.log(color_success, "Finished getting the agents_list");

  console.log(color_start, "Reading posts list...");
  const posts_list = await CSVToJSON().fromFile(posts_inputFile);
  console.log(color_success, "Finished getting the posts list");

  console.log(color_start, "Reading comment list...");
  const comments_list = await CSVToJSON().fromFile(replies_inputFile);
  console.log(color_success, "Finished getting the comment list");

  console.log(color_start, "Reading scenario list...");
  const scenarios_list = await CSVToJSON().fromFile(scenarios_inputFile);
  console.log(color_success, "Finished getting the scenario list");

  console.log(color_start, "Reading objective list...");
  const objectives_list = await CSVToJSON().fromFile(objectives_inputFile);
  console.log(color_success, "Finished getting the objective list");

  /*
   * Create all the Actors and Agents in the simulation
   * Must be done before creating any other instances
   */
  const actors = actors_list.map((actor_raw) => {
    const username = actor_raw.username;
    if (!validateUsername(username)) {
      throw new TypeError(
        `Invalid username ${username}. Must contain only letters, numbers, or the following symbols: .-_`,
      );
    }

    return new Actor({
      actorType: "Actor",
      username: username,
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
  });

  const agents = await Promise.all(
    agents_list.map(async function (agent_raw) {
      const username = agent_raw.username;
      if (!validateUsername(username)) {
        throw new TypeError(
          `Invalid username ${username}. Must contain only letters, numbers, or the following symbols: .-_`,
        );
      }
      console.log("Row values:", agent_raw);
      const agent = new Agent({
        actorType: "Agent",
        username: username,
        profile: {
          name: agent_raw.name,
          gender: agent_raw.gender,
          age: agent_raw.age,
          location: agent_raw.location,
          bio: agent_raw.bio,
          picture: agent_raw.picture,
        },

        role: agent_raw.role,
        isLLMDriven:
          String(agent_raw.isLLMDriven).toLowerCase() ||
          agent_raw.isLLMDriven === "1",
        behaviorPrompt: agent_raw.behaviorPrompt,
        class: agent_raw.class,
        PRS: Number(agent_raw.PRS),
        CNT: Number(agent_raw.CNT),
        ANX: Number(agent_raw.ANX),
        VisitFreq: Number(agent_raw.VisitFreq),
        AT: Number(agent_raw.AT),
        PBC: Number(agent_raw.PBC),
        EMP: Number(agent_raw.EMP),
        TIN: Number(agent_raw.TIN),
        UES: Number(agent_raw.UES),
        URA: Number(agent_raw.URA),
        UAD: Number(agent_raw.UAD),
        UPS: Number(agent_raw.UPS),

        level: level,
      });

      if (agent_raw.picture) {
        await fs.cp(
          `profile_pictures/${agent_raw.picture}`,
          `${profileImageDir}/${agent_raw.picture}`,
        );
      }

      return agent;
    }),
  );

  const allActors = Object.fromEntries([
    ..._.map(actors, (a) => [a.username, a]),
    ..._.map(agents, (a) => [a.username, a]),
  ]);

  /*
   * Create each post and upload it to the DB
   * Actors must be in DB first to add them correctly to the post
   */
  const posts = Object.fromEntries(
    await Promise.all(
      posts_list.map(async function (post, index) {
        const actor = allActors[post.actor];
        if (!actor) {
          //Else no actor found
          throw new ReferenceError(`ERROR: Unknown Actor "${post.actor}"`);
        }

        const postTime = new Date(
          currDateAtPopulate + timeStringToNum(post.time),
        );
        const script = new Script({
          body: post.body,
          picture: post.picture,
          actorLikes: post.likes || getLikes(),
          postType: actor.actorType,
          poster: actor,
          absTime: postTime,
          updateTime: postTime,
          class: post.class,
          level: level,
          isRelevant:
            typeof post.isRelevant === "string"
              ? post.isRelevant.toLowerCase() === "true"
              : Boolean(post.isRelevant),
        });
        actor.posts.push(script._id);

        if (actor.actorType === "Agent" && post.picture) {
          await fs.cp(
            `post_pictures/${post.picture}`,
            `${postImageDir}/${post.picture}`,
          );
        }

        return [index + 1, script];
      }),
    ),
  );

  /*
   * Creates inline comments for each post
   * Looks up actors and posts to insert the correct comment
   */
  const comments = comments_list.map(function (reply) {
    const actor = allActors[reply.actor];
    if (!actor) {
      //No actor found
      throw new ReferenceError(`ERROR: Unknown Actor "${reply.actor}"`);
    }
    const post = posts[reply.postID];
    if (!post) {
      //No post found
      throw new ReferenceError(`ERROR: Unknown Post #${reply.postID}`);
    }

    const replyTime = currDateAtPopulate + timeStringToNum(reply.time);
    if (post.time > replyTime) {
      throw new RangeError(
        `ERROR: The simulated time for comment #${reply.id} is before the simulated post time.`,
      );
    }

    const comment = new Comment({
      commentType: actor.actorType,
      commentor: actor,
      post: post._id,
      body: reply.body,
      actorLikes: reply.likes || getLikesComment(),
      absTime: replyTime,
      updateTime: replyTime,
      class: reply.class,
      level: level,
    });

    const index = _.sortedIndexBy(
      posts.comments,
      comment,
      ({ absTime }) => absTime,
    );
    post.comments.splice(index, 0, comment._id);

    actor.comments.push(comment._id);

    return comment;
  });

  /*
   * Creates the list of scenarios
   */
  const scenarios = scenarios_list.map(
    (scenario_raw) =>
      new Scenario({
        name: scenario_raw.name,
        description: scenario_raw.description,
      }),
  );

  let solutionMap = new Map();
  try {
    const solutionFile = await fs.readFile(`${path}/solutions.json`, "utf8");
    const solutions = JSON.parse(solutionFile);
    solutionMap = new Map(solutions.map((s) => [s.category, s.description]));
  } catch (err) {
    console.warn(`⚠️ No solutions.json found in ${path}. Hints will be empty.`);
  }

  // Create objectives
  let objectives = [];
  try {
    const objectives_list = await CSVToJSON().fromFile(objectives_inputFile);
    objectives = await Promise.all(
      objectives_list.map(async (row) => {
        const objective = new Objective({
          level,
          goalCategory: row.category,
          label: row.label,
          description: row.description || "",
          hint: solutionMap.get(row.category) || null,
          isRequired: String(row.isRequired).toLowerCase() === "true",
          completed: false,
          order: row.order ? parseInt(row.order) : 0,
        });
        // ✅ Print right when it's created
        console.log(
          `📘 Objective: [Level ${objective.level}] ${objective.goalCategory} — ${objective.label} ${objective.isRequired ? "(required)" : "(optional)"}`,
        );

        return objective;
      }),
    );

    // filter out any nulls due to unresolved agents
    objectives = objectives.filter((o) => o !== null);
    console.log(
      color_success,
      `Parsed ${objectives.length} objectives for level ${level}`,
    );
  } catch (err) {
    console.log(`ℹ️ No objectives.csv found in ${path}, skipping objectives.`);
  }

  try {
    console.log(color_start, "Starting to populate actors collection...");
    await Actor.bulkSave(Object.values(actors));
    console.log(color_success, "All actors added to database!");

    console.log(color_start, "Starting to populate agents collection...");
    await Agent.bulkSave(Object.values(agents));
    console.log(color_success, "All agents added to database!");

    console.log(color_start, "Starting to populate posts collection...");
    await Script.bulkSave(Object.values(posts));
    console.log(color_success, "All posts added to database!");

    console.log(color_start, "Starting to populate post replies...");
    await Comment.bulkSave(comments);
    console.log(color_success, "All replies added to database!");

    console.log(color_start, "Starting to populate scenarios...");
    await Scenario.bulkSave(scenarios);
    console.log(color_success, "All scenarios added to database!");

    console.log(color_start, "Starting to populate objectives...");
    await Objective.bulkSave(objectives);
    console.log(color_success, "All objectives added to database!");
  } catch (err) {
    console.error(
      color_error,
      "ERROR: Something went wrong saving objects in the database",
    );
    console.error(err);
  }
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
mongoose.connection.once("open", async () => {
  await fs.mkdir(postImageDir, { recursive: true });
  await fs.mkdir(profileImageDir, { recursive: true });

  console.log(color_start, "Dropping all collections...");
  await Promise.all([
    db.collections["actors"].drop(),
    db.collections["agents"].drop(),
    db.collections["scripts"].drop(),
    db.collections["comments"].drop(),
    db.collections["scenarios"].drop(),
    db.collections["objectives"].drop(),
  ]);
  console.log(color_success, "All collections dropped.");

  const folders = process.argv.slice(2);
  if (folders.length < 1) {
    console.error("you are allow more than 1 folders");
    process.exit(1);
  }

  let level = 1;
  for (const folder of folders) {
    await doPopulate(folder, level);
    level += 1;
  }

  const levelOrder = folders.map((folder, i) => ({
    level: i + 1,
    folder,
  }));

  await fs.writeFile(
    "scenarios/level_order.json",
    JSON.stringify(levelOrder, null, 2),
  );

  console.log(color_success, "✅ Saved level_order.json");

  mongoose.connection.close();
});
