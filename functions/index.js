const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/*
// test cloud functions

// http request 1
exports.randomNumber = functions.https.onRequest((request, response) => {
  const number = Math.round(Math.random() * 100);
  console.log(number);
  response.send(number.toString());
});

// http request 2
exports.toTheDojo = functions.https.onRequest((request, response) => {
  const number = Math.round(Math.random() * 100);
  response.redirect("https://www.thenetninja.co.uk");
});

// http callable function
exports.sayHello = functions.https.onCall((data, context) => {
  const name = data.name;
  return `Hello, ${name}`;
});
*/

// auth trigger (new user signup)
exports.newUserSignUp = functions.auth.user().onCreate((user) => {
  // for background triggers you must return a value/promis
  return admin.firestore().collection("users").doc(user.uid).set({
    email: user.email,
    upvotedOn: [],
  });
});

// auth trigger (user deleted)
exports.userDeleted = functions.auth.user().onDelete((user) => {
  // for background triggers you must return a value/promis
  const doc = admin.firestore().collection("users").doc(user.uid);
  return doc.delete();
});

// http callable function (adding a request)
exports.addRequest = functions.https.onCall((data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "only authenticated users can add requests"
    );
  }
  if (data.text.length > 30) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "request must be no more than 30 characters long"
    );
  }
  admin
    .firestore()
    .collection("requests")
    .add({
      text: data.text,
      upvotes: 0,
    })
    .then(() => {
      return "new request added";
    })
    .catch(() => {
      throw new functions.https.HttpsError("internal", "request not added");
    });
});

// upvote callable function
exports.upvote = functions.https.onCall(async (data, context) => {
  // Check auth state
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "only authenticated users can add requests"
    );
  }
  // get refs for user doc & requestdoc
  const user = admin.firestore().collection("users").doc(context.auth.uid);
  const request = admin.firestore().collection("requests").doc(data.id);

  const doc = await user.get();
  // check user hasn't already upvoted the request
  if (doc.data().upvotedOn.includes(data.id)) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "You can only upvote something once"
    );
  }
  // update user array
  await user.update({
    upvotedOn: [...doc.data().upvotedOn, data.id],
  });
  // update votes on the request
  return request.update({
    upvotes: admin.firestore.FieldValue.increment(1),
  });
});
