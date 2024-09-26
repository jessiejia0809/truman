const User = require('../models/User.js');
const _ = require('lodash');

/**
 * GET /chat
 * Returns list of messages of chat with chat_id value. Chat absTimes are converted to strings.
 */
exports.getChat = async (req, res, next) => {
  try {
    let user = await User.findById(req.user.id).exec();

    const feedIndex = _.findIndex(user.chatAction, function (o) { return o.chat_id == req.query.chat_id });
    if (feedIndex != -1) {

      let messages = user.chatAction[feedIndex].messages;
      messages = messages.map(messageDoc => {
        let message = messageDoc.toObject(); // Convert to plain JavaScript object
        return {
          ...message, // Spread the existing properties of the message
          absTime: message.absTime.toLocaleTimeString().replace(/([\d]+:[\d]{2})(:[\d]{2})(.*)/, "$1$3") // Modify the absTime value
        }
      });
      res.send(messages);
    } else {
      res.send([]);
    }
  } catch (err) {
    console.log(err);
    next(err);
  }
};

/**
 * POST /chat
 * Add actions with chats.
 */
exports.postchatAction = async (req, res, next) => {
  try {
    let user = await User.findById(req.user.id).exec();
    let userAction = user.chatAction;

    // Then find the object from the right chat in feed.
    let feedIndex = _.findIndex(userAction, function (o) { return o.chat_id == req.body.chat_id; });
    if (feedIndex == -1) {
      const cat = {
        chat_id: req.body.chat_id
      };
      // add new chat into correct location
      feedIndex = userAction.push(cat) - 1;
    }

    const cat = {
      body: req.body.body,
      absTime: req.body.absTime,
      name: req.body.name,
      isAgent: req.body.isAgent
    };
    userAction[feedIndex].messages.push(cat);

    await user.save();
    let returningJson = { result: "success" };
    res.send(returningJson);
  } catch (err) {
    console.log(err);
    next(err);
  }
};