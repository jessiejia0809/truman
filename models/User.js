const bcrypt = require('@node-rs/bcrypt');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const userSchema = new mongoose.Schema({
  sessionID: String,
  // List of actions made on other's posts
  email: { type: String, unique: true },
  password: String,
  username: String,
  active: { type: Boolean, default: true }, // Indicates if the user is still active
  isAdmin: { type: Boolean, default: false }, // Indicates if the user is an administrator

  endSurveyLink: String,
  endSurveyLink: String,

  numPosts: { type: Number, default: -1 }, // Indicates the # of user posts the user has made. Count begins at 0.
  numComments: { type: Number, default: -1 }, // Indicates the # of comments on (user and actor) posts the user has made. This value is used for indexing and the commentID of user comments on (user and actor) posts. Count begins at 0.
  numActorReplies: { type: Number, default: -1 }, // Indicates the # of actor replies on user posts, it is used for indexing and the commentID of actor comments on user posts. Count begins at 0.
  numPosts: { type: Number, default: -1 }, // Indicates the # of user posts the user has made. Count begins at 0.
  numComments: { type: Number, default: -1 }, // Indicates the # of comments on (user and actor) posts the user has made. This value is used for indexing and the commentID of user comments on (user and actor) posts. Count begins at 0.
  numActorReplies: { type: Number, default: -1 }, // Indicates the # of actor replies on user posts, it is used for indexing and the commentID of actor comments on user posts. Count begins at 0.

  numPostLikes: { type: Number, default: 0 }, // Indicates the # of actor posts liked. Count begins at 1.
  numCommentLikes: { type: Number, default: 0 }, // Indicates the # of actor comments liked. Count begins at 1.
  numPostLikes: { type: Number, default: 0 }, // Indicates the # of actor posts liked. Count begins at 1.
  numCommentLikes: { type: Number, default: 0 }, // Indicates the # of actor comments liked. Count begins at 1.

  lastNotifyVisit: Date, // Absolute Time; Indicates the most recent visit to /notifications. First initialization is at account creation.
  createdAt: Date, // Absolute Time the user was created
  consent: { type: Boolean, default: false }, // Indicates if user has proceeded through the Welcome & community rule pages
  lastNotifyVisit: Date, // Absolute Time; Indicates the most recent visit to /notifications. First initialization is at account creation.
  createdAt: Date, // Absolute Time the user was created
  consent: { type: Boolean, default: false }, // Indicates if user has proceeded through the Welcome & community rule pages

  mturkID: { type: String, unique: true }, // MTurkID
  ResponseID: { type: String, unique: false }, // Qualtric's ResponseID
  mturkID: { type: String, unique: true }, // MTurkID
  ResponseID: { type: String, unique: false }, // Qualtric's ResponseID

  experimentalCondition: String, // Indicates the experimental condition user is assigned to. Values are defined in the .env file by the variable EXP_CONDITIONS_NAMES and assigned at account creation in the users controller.
  experimentalCondition: String, // Indicates the experimental condition user is assigned to. Values are defined in the .env file by the variable EXP_CONDITIONS_NAMES and assigned at account creation in the users controller.

  blocked: [String], // List of usernames of actors user has blocked
  reported: [String], // List of usernames of actors user has reported
  followed: [String], // List of usernames of actors user has followed
  blockReportAndFollowLog: [new Schema({
    time: Date, // Absolute Time of action
    action: String, // Action taken. Values include: 'block', 'unblock', 'follow', 'unfollow', 'report'
    report_issue: String, // If action taken is 'report', indicates the reason given. Values include: 'interested', 'spam', 'bully', 'hacked'
    actorName: String // Username of actor action relates to
  })],
  blocked: [String], // List of usernames of actors user has blocked
  reported: [String], // List of usernames of actors user has reported
  followed: [String], // List of usernames of actors user has followed
  blockReportAndFollowLog: [new Schema({
    time: Date, // Absolute Time of action
    action: String, // Action taken. Values include: 'block', 'unblock', 'follow', 'unfollow', 'report'
    report_issue: String, // If action taken is 'report', indicates the reason given. Values include: 'interested', 'spam', 'bully', 'hacked'
    actorName: String // Username of actor action relates to
  })],

  study_days: { // Indicates how many times the user looked at the newsfeed per day
    type: [Number],
    default: Array(parseInt(process.env.NUM_DAYS)).fill(0)
  }, // TODO: Update. It inaccurately +1, whenever creates a new post.
  study_days: { // Indicates how many times the user looked at the newsfeed per day
    type: [Number],
    default: Array(parseInt(process.env.NUM_DAYS)).fill(0)
  }, // TODO: Update. It inaccurately +1, whenever creates a new post.

  postAction: [{
    post: { type: Schema.ObjectId, ref: 'Script' },
    liked: { type: Boolean, default: false },
    flagged: { type: Boolean, default: false },
    likeTime: [Date], // List of absolute times when the user has liked the post
    unlikeTime: [Date], // List of absolute times when the user has unliked the post
    flagTime: [Date], // List of absolute times when the user has flagged the post
    unflagTime: [Date], // List of absolute times when the user has unflagged the post
    mostRecentTime: Date, // Absolute Time, indicates the most recent time the post was viewed
    rereadTimes: { type: Number, default: 0 }, // Indicates the # of times the post has been viewed by user.
  }],

  commentAction: [{
    comment: { type: Schema.ObjectId, ref: 'Comment' },
    liked: { type: Boolean, default: false }, // Whether the user liked the comment
    flagged: { type: Boolean, default: false }, // Whether the user flagged the comment
    likeTime: [Date], // List of absolute times when the user has liked the comment
    unlikeTime: [Date], // List of absolute times when the user has unliked the comment
    flagTime: [Date], // List of absolute times when the user has flagged the comment
    unflagTime: [Date], // List of absolute times when the user has unflagged the comment
  }],

  chatAction: [new Schema({
    chat_id: String, // chat id's are defined by who it is in correspondance with: aka actors' usernames
    messages: [new Schema({
      body: { type: String, default: '', trim: true }, // Body of the chat message
      absTime: Date, // The absolute date (time) of when the chat message was made
      name: String, // Indicates who made the chat message
    }, { _id: true, versionKey: false })],
  }, { _id: false, versionKey: false })],

  profile: {
    name: String,
    location: String,
    bio: String,
    picture: String
  }
  profile: {
    name: String,
    location: String,
    bio: String,
    picture: String
  }
}, { timestamps: true, versionKey: false });

/**
 * Password hash middleware.
 */
userSchema.pre('save', async function save(next) {
  const user = this;
  if (!user.isModified('password')) { return next(); }
  try {
    user.password = await bcrypt.hash(user.password, 10);
    next();
  } catch (err) {
    next(err);
  }
  const user = this;
  if (!user.isModified('password')) { return next(); }
  try {
    user.password = await bcrypt.hash(user.password, 10);
    next();
  } catch (err) {
    next(err);
  }
});

/**
* Helper method for validating user's password.
*/
userSchema.methods.comparePassword = async function comparePassword(candidatePassword, cb) {
  try {
    cb(null, await bcrypt.verify(candidatePassword, this.password));
  } catch (err) {
    cb(err);
  }
  try {
    cb(null, await bcrypt.verify(candidatePassword, this.password));
  } catch (err) {
    cb(err);
  }
};

/**
* Add login instance to user.log
*/
userSchema.methods.logUser = async function logUser(time, agent, ip) {
  try {
    this.log.push({
      time: time,
      userAgent: agent,
      ipAddress: ip
    });
    await this.save();
  } catch (err) {
    console.log(err);
  }
  try {
    this.log.push({
      time: time,
      userAgent: agent,
      ipAddress: ip
    });
    await this.save();
  } catch (err) {
    console.log(err);
  }
};

/**
* Add page visit instance to user.pageLog
*/
userSchema.methods.logPage = async function logPage(time, page) {
  try {
    this.pageLog.push({
      time: time,
      page: page
    });
    await this.save();
  } catch (err) {
    console.log(err);
  }
  try {
    this.pageLog.push({
      time: time,
      page: page
    });
    await this.save();
  } catch (err) {
    console.log(err);
  }
};

/** 
* Calculate stats: Basic user statistics (not comprehensive) 
* Also displayed in /completed (Admin Dashboard) for admin accounts.
*/
userSchema.methods.logPostStats = function logPage() {
  const counts = this.feedAction.reduce(function (newCount, feedAction) {
    const numLikes = feedAction.comments.filter(comment => comment.liked && !comment.new_comment).length;
    const numNewComments = feedAction.comments.filter(comment => comment.new_comment).length;
    const counts = this.feedAction.reduce(function (newCount, feedAction) {
      const numLikes = feedAction.comments.filter(comment => comment.liked && !comment.new_comment).length;
      const numNewComments = feedAction.comments.filter(comment => comment.new_comment).length;

      newCount[0] += numLikes;
      newCount[1] += numNewComments;
      return newCount;
    }, [0, 0], //[actorCommentLikes, newComments]
    );
    newCount[0] += numLikes;
    newCount[1] += numNewComments;
    return newCount;
  }, [0, 0], //[actorCommentLikes, newComments]
  );

  const log = {
    SiteVisits: this.log.length,
    GeneralTimeSpent: this.pageTimes.reduce((partialSum, a) => partialSum + a, 0),
    GeneralPostNumber: this.numPosts + 1,
    GeneralPostLikes: this.feedAction.filter(feedAction => feedAction.liked).length,
    GeneralCommentLikes: counts[0],
    GeneralPostComments: counts[1]
  }
  this.postStats = log;
};

/**
* Helper method for getting all User Posts.
*/
userSchema.methods.getPosts = function getPosts() {
  let ret = this.posts;
  ret.sort(function (a, b) {
    return b.relativeTime - a.relativeTime;
  });
  for (const post of ret) {
    post.comments.sort(function (a, b) {
      return a.relativeTime - b.relativeTime;
    });
  }
  return ret;
};

// Return the user post from its ID
userSchema.methods.getUserPostByID = function (postID) {
  return this.posts.find(x => x.postID == postID);
};

// Get user posts within the min/max time period
userSchema.methods.getPostInPeriod = function (min, max) {
  return this.posts.filter(function (post) {
    return post.relativeTime >= min && post.relativeTime <= max;
  });
}

/**
* Helper method for getting user's gravatar.
*/
userSchema.methods.gravatar = function gravatar(size) {
  if (!size) {
    size = 200;
  }
  if (!this.email) {
    return `https://gravatar.com/avatar/?s=${size}&d=retro`;
  }
  const md5 = crypto.createHash('md5').update(this.email).digest('hex');
  return `https://gravatar.com/avatar/${md5}?s=${size}&d=retro`;
  if (!size) {
    size = 200;
  }
  if (!this.email) {
    return `https://gravatar.com/avatar/?s=${size}&d=retro`;
  }
  const md5 = crypto.createHash('md5').update(this.email).digest('hex');
  return `https://gravatar.com/avatar/${md5}?s=${size}&d=retro`;
};

const User = mongoose.model('User', userSchema);
module.exports = User;