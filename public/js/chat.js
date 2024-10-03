// Opens the actor chat
var socket = io();
const toggleAmount = 300;
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
    $('.actor-chat .chat .chat-history').slideToggle(toggleAmount, 'swing');
  }
  // Get previous messages in #USERNAME chat and update chat messages
  await $.getJSON("/chat", { "chat_id": username }, function (data) {
    for (const msg of data) {
      chat.addMessageExternal(msg.body, msg.absTime, msg.name);
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
        chat.addMessageExternal(msg.body, msg.absTime, msg.name);
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
      chat.addTypingAnimationExternal(msg.name);
    }
  });

  // Enable popups over usernames
  $('.username').popup({
    hoverable: true,
    onShow: function (el) {
      const username = $(el).attr('data-username');
      const picture = $(el).attr('data-picture');

      // Update the popup content dynamically
      $(this).html(`<div class='header'><img class='ui avatar image' src='/profile_pictures/${picture}'/>${username}</div><div class='content'><button class='ui small button basic message-button' onClick="clickMessageUser(event)">Message</button></div>`);
    }
  });


  // Message button
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
          this.$profile = $('img.mini.spaced.circular.image').attr('src');
        }
      },
      bindEvents: function () {
        this.$button.on('click', this.addMessage.bind(this));
        this.$textarea.on('keydown', this.addMessageTyping.bind(this));
      },
      // Renders a message
      render: function (body, absTime, name, isExternalMessage, isTypingAnimation) {
        const absTimeFormatted = new Date(absTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        if (this.typingTimeout != null) {
          clearTimeout(this.typingTimeout);
          this.typingTimeout = null;
          this.removeTypingAnimationExternal();
        }
        if (isTypingAnimation || body.trim() !== '') {
          const li = document.createElement('li');
          li.classList.add('clearfix');

          const messageDiv = document.createElement('div');
          messageDiv.classList.add('ui', 'grid', 'centered');
          li.appendChild(messageDiv);

          const messageContent = `
            <div class="thirteen wide right aligned column padding-right-small my-message-div">
              <div class="my-message align-right">
                ${isTypingAnimation ? '<img src="/typing.gif"/>' : body}
              </div>
              <span class="message-data-time align-right">${absTimeFormatted}</span>
            </div>
            <div class="three wide column padding-left-small">
              <div class="align-center">
                ${this.mostRecentMessenger != name ? `<img class="message-avatar" src="${this.$profile}"/>` : ''}
              </div>
            </div>
          `;

          messageDiv.innerHTML = messageContent;
          if (!isTypingAnimation) {
            this.mostRecentMessenger = name;
          }
          this.$chatHistoryList.append(li);


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
          this.$chatHistory.slideToggle(toggleAmount, 'swing');
        }
      },


      // Handles the addition of outgoing message (by the user) to chat history
      addMessage: function () {
        const name = "Me";
        const message = this.$textarea.val();
        const absTime = Date.now();


        const actorSrc = this.$img.attr("src");


        socket.emit("chat message", {
          chatId: this.chatId,
          body: message,
          absTime: absTime,
          name: name,
          actorSrc: actorSrc
        });
        this.render(message, absTime, name, false, false);


        $.post("/chat", {
          chat_id: this.chatId,
          body: message,
          absTime: absTime,
          name: name,
          _csrf: $('meta[name="csrf-token"]').attr('content')
        });
      },


      // Handles the addition of an incoming message to chat history
      addMessageExternal: function (body, absTime, name) {
        this.render(body, absTime, name, true, false);
      },


      // Handles typing events in the textarea of chats
      addMessageTyping: function (event) {
        if (event.keyCode == 13 && !event.ctrlKey) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.addMessage();
        } else {
          event.stopImmediatePropagation();
          const name = "Me";
          const actorSrc = this.$img.attr("src");


          socket.emit("chat typing", {
            chatId: this.chatId,
            name: name,
            msg: this.$textarea.val(),
            actorSrc: actorSrc
          });
        }
      },


      // Adds typing animation
      addTypingAnimationExternal: function (name) {
        if (this.typingTimeout == null) {
          this.render(undefined, undefined, name, true, true);
        } else {
          clearTimeout(this.typingTimeout);
        }
        this.typingTimeout = setTimeout(() => {
          this.typingTimeout = null;
          this.removeTypingAnimationExternal();
        }, 3000);
      },


      // Removes typing animation
      removeTypingAnimationExternal: function (name) {
        this.$chatHistoryList.find(".ui.grid.centered:last").remove();
      },


      scrollToBottom: function () {
        if (this.$chatHistory[0]) {
          this.$chatHistory.scrollTop(this.$chatHistory[0].scrollHeight);
        }
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
    chat.slideToggle(toggleAmount, 'swing');
  });


  // Close chat box
  $('.chat-close').click(function (e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    $('.actor-chat .chat').transition('fade down');
  });
});