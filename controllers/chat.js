const Chat = require("../models/Chat.js");
const helpers = require("./helpers.js");
const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * GET /chat
 * Returns the list of messages of chat with chat_id value and the receiver's attributes
 */
exports.getChat = async (req, res, next) => {
  try {
    if (req.query.chatId === "chatbot") {
      return res.send({
        messages: [],
        actorType: "ChatBot",
        username: "chatbot",
        picture: "public/chatbot.png",
        name: "ChatBot",
      });
    } else {
      // Retrieve the chat by ID, populating messenger field in messages
      const chat = await Chat.findOne({ chat_id: req.query.chatFullId })
        .populate("messages.messenger")
        .exec();

      const actor = await helpers.lookupActorByName(req.query.chatId);

      // If actor or chat is not found, return an empty message array with the actor
      if (!actor) return next(new Error("Actor not found"));

      // Find profile photo of actor
      let picture;
      if (actor.actorType == "User" || actor.actorType == "Agent") {
        if (actor.profile.picture)
          picture = "/user_avatar/" + actor.profile.picture;
        else picture = actor.gravatar(60);
      } else {
        picture = "/profile_pictures/" + actor.profile.picture;
      }
      if (!chat) {
        return res.send({
          messages: [],
          actorType: actor.actorType,
          username: actor.username,
          picture: picture,
          name: actor.profile.name,
          isLLMDriven: actor.isLLMDriven,
        });
      }

      // Map messages to plain JavaScript objects
      const messages = chat.messages.length
        ? chat.messages.map((msg) => msg.toObject())
        : [];

      res.send({
        messages: messages,
        actorType: actor.actorType,
        username: actor.username,
        picture: picture,
        name: actor.profile.name,
        isLLMDriven: actor.isLLMDriven,
      });
    }
  } catch (err) {
    console.error(err);
    next(err);
  }
};

/**
 * POST /chat
 * Add actions with chats.
 */
exports.postChatAction = async (req, res, next) => {
  try {
    if (req.body.chatFullId === "chatbot") {
      // forward user message to OpenAI instead of saving to DB
      const userMsg = req.body.body;
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a helpful chatbot assistant." },
          { role: "user", content: userMsg },
        ],
        max_tokens: 300,
        temperature: 0.7,
      });
      const reply = completion.choices[0].message.content.trim();
      return res.send({ result: "success", reply });
    } else {
      let chat = await Chat.findOne({ chat_id: req.body.chatFullId }).exec();
      if (!chat) {
        chat = new Chat({ chat_id: req.body.chatFullId, messages: [] });
      }

      // push & save the USER message
      const sender = await helpers.lookupActorByName(req.body.username);
      sender.chatAction.push(chat.id);
      chat.messages.push({
        messageType: sender.actorType,
        messenger: sender._id,
        body: req.body.body,
        absTime: req.body.absTime,
      });
      await chat.save();
      await sender.save();

      // recipient
      const [a, b] = req.body.chatFullId.split("-");
      const otherUsername = a === req.body.username ? b : a;
      const recipient = await helpers.lookupActorByName(otherUsername);

      // call openai is llmDriven
      if (recipient.isLLMDriven) {
        const behavior = recipient.behaviorPrompt || "";
        const systemPrompt = `
          You are now role-playing as ${otherUsername}:
          ${behavior}

          Answer the user as this character.
                `.trim();

        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: req.body.body },
          ],
          max_tokens: 300,
          temperature: 0.5,
        });
        const reply = completion.choices[0].message.content.trim();

        res.send({ result: "success", reply });

        recipient.chatAction.push(chat.id);
        chat.messages.push({
          messageType: recipient.actorType,
          messenger: recipient._id,
          body: reply,
          absTime: new Date(),
        });
        await chat.save();
        await recipient.save();
      } else {
        // not LLM-driven -> no extra message
        return res.send({ result: "success" });
      }
    }
  } catch (err) {
    console.log(err);
    next(err);
  }
};
