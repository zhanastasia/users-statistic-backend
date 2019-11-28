const functions = require("firebase-functions");

const admin = require("firebase-admin");
const express = require("express");
var cors = require("cors");
const app = express();
const port = 5000;
const pageSize = 10;
let serviceAccount = require("./serviceAccount.json");

app.use(cors());
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

let db = admin.firestore();

app.get("/api", function(req, res, next) {
  res.json({ msg: "This is CORS-enabled for all origins!" });
});

app.get("/api/users", async (req, res) => {
  let users = [];
  let usersId = [];
  let page = req.query.page;
  let userDetails = req.query.userDetails;
  let isTrueSet = userDetails == "true";

  if (isTrueSet) {
    await db
      .collection("users")
      .offset(page * pageSize - pageSize)
      .limit(pageSize)
      .get()
      .then(snapshot => {
        snapshot.forEach(doc => {
          const user = doc.data();
          users.push(user);
          usersId.push(user.id);
        });

        if (users.length === 0) {
          return res.status(204).send();
        }

        users.forEach(u => {
          u.userStats = [];
        });

        db.collection("users_statistic")
          .where("user_id", "in", usersId)
          .get()
          .then(snapshot => {
            snapshot.forEach(doc => {
              let userStat = doc.data();
              let userIndex = users.findIndex(u => u.id === userStat.user_id);

              if (userIndex < 0) {
                return;
              }

              users[userIndex].userStats.push(userStat);
            });
            res.send(users);
          })
          .catch(err => {
            console.log("Error getting documents", err);
          });
      })
      .catch(err => {
        console.log("Error getting documents", err);
      });
  }
});

app.get("/api/users-statistic", async (req, res) => {
  let usersStatistic = [];

  await db
    .collection("users_statistic")
    .limit(pageSize)
    .get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        usersStatistic.push(doc.data());
      });
      res.send(usersStatistic);
    });
});

app.get("/api/users/:id/user-stats", async (req, res) => {
  let from = req.query.from;
  let to = req.query.to;
  const id = req.params.id;
  let result = [];

  usersStatisticQuery = db
    .collection("users_statistic")
    .where("user_id", "==", +id);

  if (from) {
    usersStatisticQuery = usersStatisticQuery.where(
      "date",
      ">=",
      convertDate(from)
    );
  }
  if (to) {
    usersStatisticQuery = usersStatisticQuery.where(
      "date",
      "<=",
      convertDate(to)
    );
  }
  try {
    await usersStatisticQuery.get().then(snapshot => {
      snapshot.forEach(doc => {
        if (doc.exists) {
          result.push(doc.data());
        }
      });
      res.send(result);
    });
  } catch (err) {
    console.error(err);
  }
});

function convertDate(date) {
  return new Date(date).toISOString().split("T")[0];
}

app.listen(port);
exports.app = functions.https.onRequest(app);
