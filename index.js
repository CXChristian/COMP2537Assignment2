require("./utils.js");

// loads environment variables from env to process.env while holding sensitive information
require('dotenv').config();

//used to access express and session 
const express = require('express');
const session = require('express-session');
const app = express();

//used to connect to mongodb
const bcrypt = require('bcrypt');
const { MongoClient } = require('mongodb');
app.use(express.urlencoded({ extended: false }));
var { database } = include('databaseConnection');
const userCollection = database.db('sessions').collection('users');

const Joi = require("joi");

//the port that is used to run the local host
const port = process.env.PORT || 3080;

//connecting to mongodb, tutorial code from mongodb site
async function mongodbConnect() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);

    //connects to mongodb or catches error
    try {
        await client.connect();
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

mongodbConnect().catch(console.error);

//creates a session based
app.use(session({
    secret: process.env.NODE_SESSION_SECRET,
    saveUninitialized: false,
    resave: true
}))

//main page
app.get('/', (req, res) => {
    var html = `Conrad's COMP 2537 Web Dev Assignment 1`;
    if (req.session.authenticated) {
        html += `
        Hello, ${req.session.name}
        <div><a href ="/members">Go to Members Area</a></div>
        <div><a href ="/logout">Logout</a></div>
        `;
        res.send(html);
    } else {
        html += `
        <div><a href ="/signup">Sign Up</a></div>
        <div><a href ="/login">Log In</a></div>
        `;
        res.send(html);
    }
});

//signup page
app.get('/signup', (req, res) => {
    var html = `
    <div>create user</div>
    <form action='/createUser' method='post'>
    <input name='name' type='text' placeholder='name'>
    <input name='email' type='text' placeholder='email'>
    <input name='password' type='password' placeholder='password'>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});

//create user page
app.post('/createUser', async (req, res) => {
    var name = req.body.name;
    var email = req.body.email;
    var password = req.body.password;

    if (!req.body.name || req.body.name.trim() === '') {
        res.redirect("/createUserInvalidName");
        return;
    }

    if (!req.body.email || req.body.email.trim() === '') {
        res.redirect("/createUserInvalidEmail");
        return;
    }

    if (!req.body.password || req.body.password.trim() === '') {
        res.redirect("/createUserInvalidPassword");
        return;
    }

    console.log(name);

    const schema = Joi.object(
        {
            name: Joi.string().alphanum().max(20).required(),
            email: Joi.string(),
            password: Joi.string().max(20).required()
        });

    const validationResultName = schema.validate({ name, password, email });
    if (validationResultName.error != null) {
        console.log(validationResultName.error);
        res.redirect("/createUserInvalid");
        return;
    }

    var hashedPassword = await bcrypt.hash(password, 12);

    await userCollection.insertOne({ name: name, password: hashedPassword, email: email });
    console.log("Inserted user into mongodb");

    var html = "successfully created user";
    res.send(html);
});

app.get('/createUserInvalid', (req, res) => {
    var html = `
        signin requirements not met

        <div><a href ="/signup">Try again</a></div>
    `;
    res.send(html);
})

app.get('/createUserInvalidName', (req, res) => {
    var html = `
        Please provide a name.

        <div><a href ="/signup">Try again</a></div>
    `;
    res.send(html);
})

app.get('/createUserInvalidEmail', (req, res) => {
    var html = `
        Please provide an email address.

        <div><a href ="/signup">Try again</a></div>
    `;
    res.send(html);
})

app.get('/createUserInvalidPassword', (req, res) => {
    var html = `
        Please provide a password.

        <div><a href ="/signup">Try again</a></div>
    `;
    res.send(html);
})

//login page
app.get('/login', (req, res) => {
    var html = `
    log in
    <form action='/loggingin' method='post'>
    <input name='email' type='text' placeholder='email'>
    <input name='password' type='password' placeholder='password'>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});

//members page
app.get('/members', (req, res) => {
    var html = `
    <div>Placeholder for members</div>
    `;
    res.send(html);
});

//logout page
app.get('/logout', (req, res) => {
    var html = `
    <div>Placeholder for logout</div>
    `;
    res.send(html);
});

//redirects/catches 404 pages
app.get("*", (req, res) => {
    res.status(404);
    res.send("Sorry! We could not find that page. Error 404");
})

//console log the port being used
app.listen(port, () => {
    console.log("Listening on port " + port);
});
