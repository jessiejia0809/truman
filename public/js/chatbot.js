// Opens the actor chat
var socket = io();
async function openActorChat(username, picture) {
  // Update chat header with given actor metadata
  $(".actor-chat").attr("id", username);
  $(".actor-chat .chat .chat-header img.ui.avatar.image").attr("src", picture);
  $(".actor-chat .chat .chat-header .chat-about .chat-with").text("Chat with " + username);
  // Update chat instance
  const chat = $('.actor-chat.container.clearfix').data('chatInstance');
  chat.chatId = username;
  chat.mostRecentMessenger = null;
  chat.typingTimeout = null;
  chat.resetChat();
  // If chat is hidden, show chat
  if (!$('.actor-chat .chat').is(":visible")) {
    $('.actor-chat .chat').transition('fade up');
  }
  // If chat history is hidden, toggle chat history up
  if (!$('.actor-chat .chat .chat-history').is(":visible")) {
    $('.actor-chat .chat .chat-history').slideToggle(300, 'swing');
  }
  // Get previous messages in #USERNAME chat and update chat messages
  await $.getJSON("/chat", { "chat_id": username }, function (data) {
    for (const msg of data) {
      chat.addMessageExternal(msg.body, msg.absTime, msg.name, msg.isAgent);
    }
  });


}


// Handles clicking the "Message (actor)" button
function clickMessageUser(event) {
  const target = $(event.target);
  const username = target.parent().siblings(".header").text();
  const picture = target.parent().siblings(".header").find("img").attr("src");
  openActorChat(username, picture);
}


// Handles clicking the "Message (actor)" button from actor's profile
function messageFromProfile(event) {
  const target = $(event.target);
  const username = target.attr('actor_un');
  const picture = target.attr('actor_pic');
  openActorChat(username, picture);
}


$(window).on("load", function () {


  // Socket listening to broadcasts
  // Incoming messages
  socket.on("chat message", async function (msg) {
    const chatId = msg.chatId;
    const chat = $('.actor-chat.container.clearfix').data('chatInstance');
    if (chat) {
      //- If message received is to a new actor
      if (chatId != chat.chatId) {
        await openActorChat(msg.chatId, msg.actorSrc);
      } else {
        chat.addMessageExternal(msg.body, msg.absTime, msg.name, msg.isAgent);
      }
    }
  });


  // // Incoming typing
  socket.on("chat typing", async function (msg) {
    const chatId = msg.chatId;
    const chat = $('.actor-chat.container.clearfix').data('chatInstance');
    if (chat) {
      //- If message received is to a new actor
      if (chatId != chat.chatId) {
        await openActorChat(msg.chatId, msg.actorSrc);
      }
      chat.addTypingAnimationExternal(msg.name, msg.isAgent);
    }
  });


  // Enable popups over usernames
  $('.username').popup({ hoverable: true });


  //Message button
  $('.ui.basic.primary.message-user.button').on('click', messageFromProfile);


  // Define and initiate chats
  $('.container.clearfix').each(function () {
    const chatId = this.id;
    const chat = {
      mostRecentMessenger: null,
      chatId: chatId,
      typingTimeout: null,
      init: function () {
        this.cacheDOM();
        this.bindEvents();
        $(this.$chatHistory).closest('.container.clearfix').data('chatInstance', this); // Store instance
      },
      cacheDOM: function () {
        if (chatId) {
          this.$chatHistory = $('#' + chatId + ' .chat-history');
          this.$button = $('#' + chatId + ' button');
          this.$textarea = $('#' + chatId + ' #message-to-send');
          this.$img = $('#' + chatId + ' img.ui.avatar.image');
          this.$chatHistoryList = this.$chatHistory.find('ul');
        } else {
          this.$chatHistory = $('.actor-chat .chat-history');
          this.$button = $('.actor-chat button');
          this.$textarea = $('.actor-chat #message-to-send');
          this.$img = $('.actor-chat img.ui.avatar.image');
          this.$chatHistoryList = this.$chatHistory.find('ul');
        }
      },
      bindEvents: function () {
        this.$button.on('click', this.addMessage.bind(this));
        this.$textarea.on('keydown', this.addMessageTyping.bind(this));
      },
      // Renders a message
      render: function (body, absTime, name, isAgent, isExternalMessage, isTypingAnimation) {
        if (this.typingTimeout != null) {
          clearTimeout(this.typingTimeout);
          this.typingTimeout = null;
          this.removeTypingAnimationExternal();
        }
        if (isTypingAnimation || body.trim() !== '') {
          let template;
          if (isAgent) {
            template = Handlebars.compile($("#other-message-template").html());
          } else {
            template = Handlebars.compile($("#my-message-template").html());
          }
          let context = {
            name: name,
            messageOutput: body,
            time: absTime,
            addProfilePhoto: this.mostRecentMessenger != name,
            isTypingAnimation: isTypingAnimation,
            profilePicture: $('img.mini.spaced.circular.image').attr('src')
          };
          if (!isTypingAnimation) {
            this.mostRecentMessenger = name;
          }


          this.$chatHistoryList.append(template(context));


          this.scrollToBottom();
          if (!isExternalMessage) {
            this.$textarea.val('');
          }
        } else {
          this.scrollToBottom();
          if (!isExternalMessage) {
            this.$textarea.val('');
          }
        }
        if (!this.$chatHistory.is(":visible")) {
          this.$chatHistory.slideToggle(300, 'swing');
        }
      },


      // Handles the addition of outgoing message (by the user) to chat history
      addMessage: function () {
        const isAgent = $('#isAgentCheckbox input').is(":checked");
        const agentType = $('#agentTypeDropdown').dropdown('get value');
        const name = !isAgent ? "Me" : agentType;
        const message = this.$textarea.val();
        const time = this.getCurrentTime();


        const actorSrc = this.$img.attr("src");


        socket.emit("chat message", {
          chatId: this.chatId,
          body: message,
          absTime: time,
          name: name,
          isAgent: isAgent,


          actorSrc: actorSrc
        });
        this.render(message, time, name, isAgent, false, false);


        $.post("/chat", {
          chat_id: this.chatId,
          body: message,
          absTime: Date.now(),
          name: name,
          isAgent: isAgent,
          _csrf: $('meta[name="csrf-token"]').attr('content')
        });
      },


      // Handles the addition of an incoming message to chat history
      addMessageExternal: function (body, absTime, name, isAgent) {
        this.render(body, absTime, name, isAgent, true, false);
      },


      // Handles typing events in the textarea of chats
      addMessageTyping: function (event) {
        if (event.keyCode == 13 && !event.ctrlKey) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.addMessage();
        } else {
          event.stopImmediatePropagation();
          const isAgent = $('#isAgentCheckbox input').is(":checked");
          const agentType = $('#agentTypeDropdown').dropdown('get value');
          const name = !isAgent ? "Me" : agentType;
          const actorSrc = this.$img.attr("src");


          socket.emit("chat typing", {
            chatId: this.chatId,
            name: name,
            msg: this.$textarea.val(),
            isAgent: isAgent,


            actorSrc: actorSrc
          });
        }
      },


      // Adds typing animation
      addTypingAnimationExternal: function (name, isAgent) {
        if (this.typingTimeout == null) {
          this.render(undefined, undefined, name, isAgent, true, true);
        } else {
          clearTimeout(this.typingTimeout);
        }
        this.typingTimeout = setTimeout(() => {
          this.typingTimeout = null;
          this.removeTypingAnimationExternal();
        }, 3000);
      },


      // Removes typing animation
      removeTypingAnimationExternal: function (name, isAgent) {
        this.$chatHistoryList.find(".ui.grid.centered:last").remove();
      },


      scrollToBottom: function () {
        if (this.$chatHistory[0]) {
          this.$chatHistory.scrollTop(this.$chatHistory[0].scrollHeight);
        }
      },


      getCurrentTime: function () {
        return new Date().toLocaleTimeString().
          replace(/([\d]+:[\d]{2})(:[\d]{2})(.*)/, "$1$3");
      },


      resetChat: function () {
        this.$chatHistoryList.empty();
      }
    };
    chat.init();
  });


  // Minimize chat box
  $('.chat-minimize, .chat-header').click(function (e) {
    e.stopImmediatePropagation();
    let chat = $(this).closest('.chat').children('.chat-history');
    chat.slideToggle(300, 'swing');
  });


  // Close chat box
  $('.chat-close').click(function (e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    $('.actor-chat .chat').transition('fade down');
  });
});