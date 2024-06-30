const apiKeyComment = "AIzaSyBYrnwSBsiVpaZAgbdaRZpMllQuhuqZCZ4";

function fillCommentUsersTable(commentUsers) {
   const commentUsersTableBody = document.getElementById("youtube_comment_users");
   var commentUsersTableBodyContent = "";

   commentUsers.map((user, index) => {
      const rowId = `row-${index}`;
      const inputId = `input-${index}`;
      const checkboxId = `checkbox-${index}`;

      commentUsersTableBodyContent += `
          <tr><span style="padding-left:10px;">${user.fullName}<span></tr>
          <tr id="${rowId}">

              <td><input type="text" id="${inputId}" user_id="${index}" style="width:100%;" name="comment" placeholder="Enter comment here !!!" disabled /></td>
              <td><input type="checkbox" id="${checkboxId}" name="rowSelect" value="${index}" /></td>
          </tr>
          `;
   });

   commentUsersTableBody.innerHTML = commentUsersTableBodyContent;

   // Add event listeners after the table is populated
   commentUsers.map((user, index) => {
      const input = document.getElementById(`input-${index}`);
      const checkbox = document.getElementById(`checkbox-${index}`);

      checkbox.addEventListener("change", function () {
         input.disabled = !this.checked;
         if (this.checked) {
            input.focus();
         }
      });
   });
}

function selectAllMails() {
   var form = document.getElementById("commentsForm");
   if (form) {
      var checkboxes = form.querySelectorAll('input[type="checkbox"][name="rowSelect"]');
      checkboxes.forEach(function (checkbox) {
         checkbox.checked = true;
         // Trigger the change event manually
         var event = new Event("change");
         checkbox.dispatchEvent(event);
      });
   }
}

async function addCommentToYouTubeVideo(videoId, commentText, accessToken) {
   const url = "https://www.googleapis.com/youtube/v3/commentThreads?part=snippet";

   const body = {
      snippet: {
         topLevelComment: {
            snippet: {
               textOriginal: commentText,
            },
         },
         videoId: videoId,
      },
   };

   try {
      const response = await fetch(url, {
         method: "POST",
         headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
         },
         body: JSON.stringify(body),
      });

      if (!response.ok) {
         const errorResponse = await response.json();
         return { success: false, error: errorResponse };
      }
      const result = await response.json();
      return { success: true, response: result };
   } catch (error) {
      return { success: false, error: error.message };
   }
}

async function generateComments(YoutubeUsers) {
   document.getElementById("message_comment_form").textContent = "";
   document.getElementById("message_comment").textContent = "";
   const videoElement = document.getElementById("comments");
   const videoId = videoElement.getAttribute("video_id");
   const form = document.getElementById("commentsForm");
   const commentInputs = form.querySelectorAll('input[type="text"][name="comment"]');
   const enabledInputs = [];

   if (!videoId) {
      return (document.getElementById("message_comment_form").textContent = "Wrong video input!!!");
   }

   commentInputs.forEach(function (commentInput) {
      if (!commentInput.disabled) {
         enabledInputs.push(commentInput);
      }
   });

   for (let enabledInput of enabledInputs) {
      if (enabledInput.value.length === 0) {
         document.getElementById("message_comment_form").textContent =
            "Not all comment inputs filled !!!";
         return; // Zastaví celú funkciu generateComments
      }
   }

   let userIds = [];
   enabledInputs.forEach(function (enabledInput) {
      let userId = enabledInput.getAttribute("user_id");
      userIds.push({ userId: parseInt(userId), message: enabledInput.value });
   });

   if (userIds.length === 0) {
      return (document.getElementById("message_comment_form").textContent =
         "You need to select at least one user!");
   }

   const usersWithCommentsToUse = userIds.map((userId) => {
      return { ...YoutubeUsers[userId.userId], comment: userId.message };
   });

   const usersAuthorizedPromises = usersWithCommentsToUse.map(async (user) => {
      const access_token = await fetchAccessTokenForCommentUser(
         user.refreshToken,
         user.clientId,
         user.clientSecret
      );
      return { ...user, access_token: access_token };
   });

   const usersAuthorized = await Promise.all(usersAuthorizedPromises);
   const commentPromises = usersAuthorized.map(async (user) => {
      return await addCommentToYouTubeVideo(videoId, user.comment, user.access_token);
   });

   const was_comments_succesfull_info = await Promise.all(commentPromises);
   //overenie, či všetky komentáre boli úspešné
   was_comments_succesfull_info.forEach((result) => {
      if (result.success !== true) {
         alert("There was problem with comment this video");
         location.reload();
      }
   });
   alert("Video was commented successfully!");
   location.reload();
}

async function fetchAccessTokenForCommentUser(refreshToken, clientId, clientSecret) {
   const url = "https://oauth2.googleapis.com/token";
   const bodyData = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
   });

   try {
      const response = await fetch(url, {
         method: "POST",
         headers: {
            "Content-Type": "application/x-www-form-urlencoded",
         },
         body: bodyData.toString(),
      });

      const data = await response.json();
      if (response.ok) {
         return data.access_token;
      } else {
         return null;
      }
   } catch (error) {
      console.error("Error during token refresh:", error);
      return null;
   }
}

async function getVideoThumbnail(url) {
   const videoId = extractVideoId(url);

   if (!videoId) {
      hideCommentUsersTable();
      return { success: false, message: "Invalid URL or video ID extraction failed." };
   }

   const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKeyComment}&part=snippet`;

   try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      if (data.items.length > 0) {
         const thumbnailUrl = data.items[0].snippet.thumbnails.standard.url;
         return { success: true, thumbnailUrl: thumbnailUrl, videoId: videoId };
      } else {
         hideCommentUsersTable();
         return { success: false, message: "Video does not exist." };
      }
   } catch (error) {
      hideCommentUsersTable();
      return { success: false, message: "Error fetching data." };
   }
}

function extractVideoId(url) {
   const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
   const match = url.match(regExp);
   return match && match[2].length === 11 ? match[2] : null;
}

async function retrieveCommentThumbnail(testUrl) {
   const result = await getVideoThumbnail(testUrl);
   if (result.success) {
      changeBackgroundImage(result.thumbnailUrl);
      document.getElementById("message_comment").textContent = "";
      document.getElementById("comments").setAttribute("video_id", result.videoId);
      showCommentUsersTable();

      window.location.href = "#selectCommentUsersNadpis";
   } else {
      document.getElementById("message_comment").textContent = result.message;
      hideCommentUsersTable();
   }
}

function showCommentUsersTable() {
   document.getElementById("video_is_correct").style.display = "block";
}

function hideCommentUsersTable() {
   document.getElementById("video_is_correct").style.display = "none";
}

function changeBackgroundImage(imageUrl) {
   // Získa rodičovský element s ID 'bg_img'
   var parentElement = document.getElementById("comments");

   // Skontroluje, či element existuje
   if (parentElement) {
      // Nastaví CSS štýl pozadia na zadaný URL obrázku
      parentElement.style.backgroundImage = "url(" + imageUrl + ")";
      parentElement.style.backgroundSize = "cover"; // Nastaví, aby obrázok pokryl celý element
      parentElement.style.backgroundPosition = "center"; // Nastaví stredovú pozíciu obrázku
      parentElement.style.backgroundRepeat = "no-repeat"; // Zabráni opakovaniu obrázku
   } else {
      console.log("Element s ID 'comments' nebol nájdený.");
   }
}
