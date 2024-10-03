const Script = require('../models/Script.js');
const Comment = require('../models/Comment.js');
const User = require('../models/User');
const Notification = require('../models/Notification');
const helpers = require('./helpers');
const _ = require('lodash');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' }); // See the file .env.example for the structure of .env

/**
 * GET /
 * Fetch and render newsfeed.
 */
exports.getScript = async (req, res, next) => {
    try {
        const one_day = 86400000; // Number of milliseconds in a day.
        const time_now = Date.now(); // Current date.
        const time_diff = time_now - req.user.createdAt; // Time difference between now and user account creation, in milliseconds.
        const time_limit = time_diff - one_day; // Date in milliseconds 24 hours ago from now. This is used later to show posts only in the past 24 hours.

        const user = await User.findById(req.user.id)
            .exec();

        // If the user is no longer active, sign the user out.
        if (!user.active) {
            req.logout((err) => {
                if (err) console.log('Error : Failed to logout.', err);
                req.session.destroy((err) => {
                    if (err) console.log('Error : Failed to destroy the session during logout.', err);
                    req.user = null;
                    req.flash('errors', { msg: 'Account is no longer active. Study is over.' });
                    res.redirect('/login' + (req.query.r_id ? `?r_id=${req.query.r_id}` : ""));
                });
            });
        }

        // What day in the study is the user in? 
        // Update study_days, which tracks the number of time user views feed.
        const current_day = Math.floor(time_diff / one_day);
        if (current_day < process.env.NUM_DAYS) {
            user.study_days[current_day] += 1;
            user.save();
        }

        // Array of actor and other user's posts that match the user's experimental condition, within the past 24 hours, sorted by descending time. 
        let script_feed = await Script.find({
            class: { "$in": ["", user.experimentalCondition] }
        })
            .where('time').lte(time_diff).gte(time_limit)
            .sort('-time')
            .populate('poster')
            .populate()
            .populate({
                path: 'comments',
                populate: {
                    path: 'commentor'
                }
            })
            .exec();

        // Array of any user-made posts within the past 24 hours, sorted by time they were created.
        // let user_posts = user.getPostInPeriod(time_limit, time_diff);
        // user_posts.sort(function (a, b) {
        //     return b.time - a.time;
        // });

        // Get the newsfeed and render it.
        const finalfeed = helpers.getFeed([], script_feed, user, process.env.FEED_ORDER, (process.env.REMOVE_FLAGGED_CONTENT == 'TRUE'), true);
        console.log("Script Size is now: " + finalfeed.length);
        res.render('script', { script: finalfeed, showNewPostIcon: true });
    } catch (err) {
        next(err);
    }
};

/*
 * Post /post/new
 * Record a new user-made post. Include any actor replies (comments) that go along with it.
 */
exports.newPost = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).exec();
        user.numPosts = user.numPosts + 1; // Count begins at 0
        await user.save();
        const currDate = Date.now();

        let post = {
            postType: "User",
            poster: req.user.id,
            postID: user.numPosts,
            body: req.body.body,
            picture: req.file ? req.file.filename : '',
            likes: 0,
            comments: [],
            absTime: currDate,
            time: currDate - user.createdAt,
        };

        //Add new post to Script
        const new_post = new Script(post);
        await new_post.save();

        // Get the newly added post from Script
        let postID = await Script.find()
            .where('poster').equals(req.user.id)
            .where('postID').equals(user.numPosts)
            .exec()
        postID = postID[0]

        // Find any Actor replies (comments) that go along with this post
        const actor_replies = await Notification.find()
            .where('userPostID').equals(post.postID)
            .where('notificationType').equals('reply')
            .populate('actor').exec();

        // If there are Actor replies (comments) that go along with this post, add them to comments
        if (actor_replies.length > 0) {
            for (const reply of actor_replies) {
                console.log(new Date(user.createdAt.getTime() + post.time + reply.time))
                user.numActorReplies = user.numActorReplies + 1; // Count begins at 0
                const tmp_actor_reply = {
                    commentType: 'Actor',
                    commentor: reply.actor._id,
                    post: postID._id,
                    body: reply.replyBody,
                    commentID: user.numActorReplies,
                    time: post.time + reply.time,
                    absTime: new Date(user.createdAt.getTime() + post.time + reply.time),
                    likes: 0,
                    comments: []
                };
                const comment = new Comment(tmp_actor_reply);
                await comment.save();
            }
        }

        // Retrieve comments for post and add to user's post
        const comments = await Comment.find()
            .where('post').equals(postID._id)
            .exec();

        for (comment of comments) {
            postID.comments.push(comment._id);
        }

        res.redirect('/');
    } catch (err) {
        console.log(err)
        next(err);
    }
};

/**
 * POST /feed/
 * Record user's actions on ACTOR/other USER's posts. 
 */
exports.postUpdateFeedAction = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).populate('postAction').exec();

        // Check if user has interacted with the post before.
        let postIndex = _.findIndex(user.postAction, function (o) { return o.post == req.body.postID; });

        // Retrieve post from database
        const post = await Script.findById(req.body.postID).populate('comments').exec();

        // If the user has not interacted with the post before, add the post to user.feedAction.
        if (postIndex == -1) {
            postIndex = user.postAction.push({ post: post._id }) - 1;
        }

        // User created a new comment on the post.
        if (req.body.new_comment) {
            // Add new comment to comment database
            user.numComments = user.numComments + 1;
            const cat = {
                commentType: 'User',
                commentor: req.user.id,
                commentID: user.numComments,
                post: res.body.postID,
                body: req.body.comment_text,
                time: req.body.new_comment - user.createdAt,
                absTime: req.body.new_comment,
                likes: 0,
                comments: []
            }
            const new_cmt = new Comment(cat);
            await new_cmt.save();

            // Add reference to comment to post it was made on
            const comment = await Comment.find()
                .where('commentor').equals(req.user.id)
                .where('commentID').equals(user.numComments)
                .exec()

            post.comments.push({ comment: comment._id })

        }
        // User interacted with a comment on the post.
        else if (req.body.commentID) {
            const isUserComment = (req.body.isUserComment == 'true');

            // Find comment
            const comment = await Comment.findById(req.body.commentID).populate('commentor').exec();

            // Check if user has interacted with the comment before.
            let commentIndex = _.findIndex(user.commentAction, function (o) { return o.comment == req.body.commentID; });

            // If the user has not interacted with the comment before, add the comment to user.commentActions
            if (commentIndex == -1) {
                const cat = {
                    comment: req.body.commentID
                };
                user.commentAction.push(cat);
                commentIndex = user.commentAction.length - 1;
            }

            // User liked the comment.
            if (req.body.like) {
                const like = req.body.like;
                user.commentAction[commentIndex].likeTime.push(like);
                user.commentAction[commentIndex].liked = true;
                comment.likes++;
                user.numCommentLikes++;
            }

            // User unliked the comment.
            if (req.body.unlike) {
                const unlike = req.body.unlike;
                user.commentAction[commentIndex].unlikeTime.push(unlike);
                user.commentAction[commentIndex].liked = false;
                comment.likes--;
                user.numCommentLikes--;
            }

            // User flagged the comment.
            else if (req.body.flag) {
                const flag = req.body.flag;
                user.commentAction[commentIndex].flagTime.push(flag);
                user.commentAction[commentIndex].flagged = true;
            }

            // User unflagged the comment.
            else if (req.body.unflag) {
                const unflag = req.body.unflag;
                user.commentAction[commentIndex].unflagTime.push(unflag);
                user.commentAction[commentIndex].flagged = false;
            }
        }
        // User interacted with the post.
        else {
            // User flagged the post.
            if (req.body.flag) {
                const flag = req.body.flag;
                user.postAction[postIndex].flagTime.push(flag);
                user.postAction[postIndex].flagged = true;
            }

            // User unflagged the post.
            else if (req.body.unflag) {
                const unflag = req.body.unflag;
                user.postAction[postIndex].unflagTime.push(unflag);
                user.postAction[postIndex].flagged = false;
            }

            // User liked the post.
            else if (req.body.like) {
                const like = req.body.like;
                user.postAction[postIndex].likeTime.push(like);
                user.postAction[postIndex].liked = true;
                post.likes++;
                user.numPostLikes++;
            }
            // User unliked the post.
            else if (req.body.unlike) {
                const unlike = req.body.unlike;
                user.postAction[postIndex].unlikeTime.push(unlike);
                user.postAction[postIndex].liked = false;
                post.likes--;
                user.numPostLikes--;
            }
            // User read the post.
            else if (req.body.viewed) {
                const view = req.body.viewed;
                user.postAction[postIndex].readTime.push(view);
                user.postAction[postIndex].rereadTimes++;
                user.postAction[postIndex].mostRecentTime = Date.now();
            } else {
                console.log('Something in feedAction went crazy. You should never see this.');
            }
        }
        await user.save();
        res.send({ result: "success", numComments: user.numComments });
    } catch (err) {
        next(err);
    }
};


// TODO: DELETE THIS METHOD --> SHOULDN'T NEED TO USE
/**
 * POST /userPost_feed/
 * Record user's actions on USER posts. 
 */
exports.postUpdateUserPostFeedAction = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).exec();
        // Find the index of object in user.posts
        let feedIndex = _.findIndex(user.posts, function (o) { return o.postID == req.body.postID; });

        if (feedIndex == -1) {
            // Should not happen.
        }
        // User created a new comment on the post.
        else if (req.body.new_comment) {
            user.numComments = user.numComments + 1;
            const cat = {
                body: req.body.comment_text,
                commentID: user.numComments,
                relativeTime: req.body.new_comment - user.createdAt,
                absTime: req.body.new_comment,
                new_comment: true,
                liked: false,
                flagged: false,
                likes: 0
            };
            user.posts[feedIndex].comments.push(cat);
        }
        // User interacted with a comment on the post.
        else if (req.body.commentID) {
            const commentIndex = _.findIndex(user.posts[feedIndex].comments, function (o) {
                return o.commentID == req.body.commentID && o.new_comment == (req.body.isUserComment == 'true');
            });
            if (commentIndex == -1) {
                console.log("Should not happen.");
            }
            // User liked the comment.
            else if (req.body.like) {
                user.posts[feedIndex].comments[commentIndex].liked = true;
            }
            // User unliked the comment. 
            else if (req.body.unlike) {
                user.posts[feedIndex].comments[commentIndex].liked = false;
            }
            // User flagged the comment.
            else if (req.body.flag) {
                user.posts[feedIndex].comments[commentIndex].flagged = true;
            }
        }
        // User interacted with the post. 
        else {
            // User liked the post.
            if (req.body.like) {
                user.posts[feedIndex].liked = true;
            }
            // User unliked the post.
            if (req.body.unlike) {
                user.posts[feedIndex].liked = false;
            }
        }
        await user.save();
        res.send({ result: "success", numComments: user.numComments });
    } catch (err) {
        next(err);
    }
}