$(window).on("load", function () {
  $(".ui.tiny.post.modal").modal({
    observeChanges: true,
  });

  // Add new post Modal functionality
  $("#newpost, a.item.newpost").click(function () {
    $(".ui.tiny.post.modal").modal("show");
  });

  // new post validator (picture and text can not be empty); using Fomantic UI
  $("#postform").form({
    on: "blur",
    fields: {
      body: {
        identifier: "body",
        rules: [
          {
            type: "empty",
            prompt: "Please add some text about your meal.",
          },
        ],
      },
      picinput: {
        identifier: "picinput",
        rules: [
          {
            type: "notExactly[/public/photo-camera.svg]",
            prompt: "Please click on the Camera Icon to add a photo.",
          },
        ],
      },
    },
    onSuccess: function (event, fields) {
      $("#postform")[0].submit();
      $(".actions .ui.green.button").addClass("disabled");
      $(".actions .ui.green.button").val("Posting...");
    },
  });

  // Socket listening to broadcasts
  // Incoming activity
  socket.on("timeline activity", function (timestamp) {
    setTimeout(
      () => {
        if ($("#newActivityMessage .ui.fixed.bottom.sticky").is(":hidden")) {
          $("#newActivityMessage .ui.fixed.bottom.sticky").show();
        }
      },
      timestamp ? Math.max(0, timestamp - Date.now()) : 0,
    );
  });

  $("#newActivityMessage .ui.fixed.bottom.sticky").on("click", function () {
    location.reload();
  });

  function saveTypedComments() {
    document.querySelectorAll(".newcomment").forEach((textarea) => {
      const postID = textarea.closest(".card")?.getAttribute("postid");
      if (postID) {
        localStorage.setItem(`draft-comment-${postID}`, textarea.value);
      }
    });
  }

  function restoreTypedComments() {
    document.querySelectorAll(".newcomment").forEach((textarea) => {
      const postID = textarea.closest(".card")?.getAttribute("postid");
      if (postID) {
        const saved = localStorage.getItem(`draft-comment-${postID}`);
        if (saved !== null) textarea.value = saved;
      }
    });
  }

  setInterval(function () {
    console.log(`🔄 Refreshing feed at ${new Date().toLocaleTimeString()}`);
    saveTypedComments(); // Save comments before refresh
    // Reload only the content inside #feed-container
    $.get(location.href, function (data) {
      // Extract new #feed-container from fetched HTML
      const newFeed = $(data).find("#feed-container");

      // Replace the entire current feed-container with the new one
      $("#feed-container").replaceWith(newFeed);

      console.log("✅ Feed refreshed with full container replacement");
      restoreTypedComments();
    });
  }, 10000);
});
