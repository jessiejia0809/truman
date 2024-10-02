const bcrypt = require('@node-rs/bcrypt');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const sessionSchema = new mongoose.Schema({

  sessionID: String,

  // List of posts made by users in current session
  posts: [new Schema({
    user: { type: Schema.ObjectId, ref: 'User' }, // Indicates which user made the post
    postID: Number, // ID for user post (0,1,2,3...)
    body: { type: String, default: '', trim: true }, // Text(body) of post
    picture: String, // Picture (file path) for post
    likes: { type: Number, default: 0 }, // Indicates the number of likes on the post by actors (excludes the user's own like)

    // Comments on post
    comments: [{ type: Schema.ObjectId, ref: 'Comment' }],

    absTime: Date, // Absolute Time; Indicates the exact time the post was made
    relativeTime: { type: Number } // Indicates when the post was made relative to how much time has passed since the user created their account, in milliseconds
  })],

}, { timestamps: true, versionKey: false });

/**
 * Helper method for getting all User Posts.
 */
sessionSchema.methods.getPosts = function getPosts() {
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


// Get user posts within the min/max time period
sessionSchema.methods.getPostInPeriod = function (min, max) {
  return this.posts.filter(function (post) {
    return post.relativeTime >= min && post.relativeTime <= max;
  });
}

const Session = mongoose.model('Session', sessionSchema);
module.exports = Session;