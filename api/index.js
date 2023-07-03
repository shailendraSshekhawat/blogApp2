const express = require("express");
const cors = require("cors");
const { default: mongoose } = require("mongoose");
const User = require("./models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const uploadMW = multer({ dest: "uploads/" });
const fs = require("fs");
const Post = require("./models/Post");
const app = express();

const salf = bcrypt.genSaltSync(10);
const secret_key = "thisisasecretkey";

app.use(cors({ credentials: true, origin: "http://localhost:3000" }));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));

mongoose.connect(
    "mongodb+srv://shelbyquiz0:12345Six@cluster0.otftjcc.mongodb.net/?retryWrites=true&w=majority"
);

app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    try {
        const userDoc = await User.create({
            username,
            password: bcrypt.hashSync(password, salf),
        });
        res.json(userDoc);
    } catch (err) {
        console.log(err);
        res.status(400).json(err);
    }
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const userDoc = await User.findOne({ username });
    // if (!userDoc) return;
    const match = bcrypt.compareSync(password, userDoc.password);
    if (match) {
        jwt.sign(
            { username, id: userDoc._id },
            secret_key,
            {},
            (err, token) => {
                if (err) {
                    console.log("token could not be created", err);
                    return;
                }
                res.cookie("token", token).json({
                    id: userDoc._id,
                    username,
                });
            }
        );
    } else {
        res.status(400).json("wrong credentials");
    }
});

app.get("/profile", (req, res) => {
    const { token } = req.cookies;
    jwt.verify(token, secret_key, {}, (err, matchInfo) => {
        if (err) {
            console.log(err);
            return;
        }
        res.json(matchInfo);
    });
});

app.post("/logout", (req, res) => {
    res.cookie("token", "").json("ok");
});

app.post("/post", uploadMW.single("image"), async (req, res) => {
    const { path } = req.file;
    const words = req.file.originalname.split(".");
    const ext = words[words.length - 1];
    const newPath = `${path}.${ext}`;
    fs.renameSync(path, newPath);

    const { token } = req.cookies;
    jwt.verify(token, secret_key, {}, async (err, info) => {
        if (err) throw err;

        // res.json(info);
        const { title, summary, content } = req.body;
        const postDoc = await Post.create({
            title,
            summary,
            content,
            cover: newPath,
            author: info.id,
        });
        res.json(postDoc);
    });
});

app.get("/post", async (req, res) => {
    res.json(
        await Post.find()
            .populate("author", ["username"])
            .sort({ createdAt: -1 })
            .limit(20)
    );
});

app.get("/post/:id", async (req, res) => {
    const { id } = req.params;
    const postDoc = await Post.findById(id).populate("author", ["username"]);
    res.json(postDoc);
});

app.put("/post", uploadMW.single("image"), async (req, res) => {
    let newPath = null;
    if (req.file) {
        const { originalname, path } = req.file;
        const words = req.file.originalname.split(".");
        const ext = words[words.length - 1];
        newPath = `${path}.${ext}`;
        fs.renameSync(path, newPath);
    }

    const { token } = req.cookies;

    jwt.verify(token, secret_key, {}, async (err, info) => {
        if (err) throw err;
        const { id, title, summary, content } = req.body;
        const postDoc = await Post.findById(id);
        const isAuthor =
            JSON.stringify(postDoc.author) === JSON.stringify(info.id);

        if (!isAuthor) {
            return res.status(400).json("you are not the author");
        }

        await postDoc.updateOne({
            title,
            summary,
            content,
            cover: newPath ? newPath : postDoc.cover,
        });
        res.json(postDoc);
    });
});

app.listen(4000);

//
